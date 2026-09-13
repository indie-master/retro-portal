#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
source=sys.stdin.read().splitlines();current_file=None;segments=[];buffer='';buffer_file=None;file_re=re.compile(r'^# configuration file (.+?):$')
def strip_comment(line):
    out=[];quote=None;esc=False
    for ch in line:
        if esc:out.append(ch);esc=False;continue
        if ch=='\\':out.append(ch);esc=True;continue
        if quote:
            out.append(ch)
            if ch==quote:quote=None
            continue
        if ch in ('"',"'"):quote=ch;out.append(ch);continue
        if ch=='#':break
        out.append(ch)
    return ''.join(out)
for raw in source:
    m=file_re.match(raw.strip())
    if m:current_file=m.group(1);continue
    line=strip_comment(raw).strip()
    if not line:continue
    if buffer and buffer_file!=current_file:buffer+=' '
    if not buffer:buffer_file=current_file
    buffer+=(' ' if buffer else '')+line
    while True:
        match=re.search(r'([{};])',buffer)
        if not match:break
        text=buffer[:match.start()].strip();delim=match.group(1);segments.append((text,delim,buffer_file));buffer=buffer[match.end():].strip();buffer_file=current_file
stack=[];servers=[];maps=[];upstreams=[]
def protocol():
    for ctx in reversed(stack):
        if ctx['kind'] in ('http','stream'):return ctx['kind']
def current(kind):
    for ctx in reversed(stack):
        if ctx['kind']==kind:return ctx
def tok(text):return re.findall(r'"[^"]*"|\'[^\']*\'|\S+',text)
for text,delim,file in segments:
    if delim=='{':
        tokens=tok(text);kind=tokens[0] if tokens else 'block';ctx={'kind':kind,'file':file,'raw':text}
        if kind=='server':ctx.update({'protocol':protocol(),'listen':[],'server_name':[],'ssl_certificate':[],'ssl_certificate_key':[],'proxy_protocol':False,'ssl_preread':False,'proxy_pass':[]})
        elif kind=='map':ctx.update({'protocol':protocol(),'source':tokens[1] if len(tokens)>1 else '','target':tokens[2] if len(tokens)>2 else '','entries':[]})
        elif kind=='upstream':ctx.update({'protocol':protocol(),'name':tokens[1] if len(tokens)>1 else '','servers':[]})
        stack.append(ctx)
    elif delim==';':
        tokens=tok(text)
        if not tokens:continue
        srv=current('server');mp=current('map');ups=current('upstream')
        if srv:
            name=tokens[0];vals=[x.strip('"\'') for x in tokens[1:]]
            if name=='listen':srv['listen'].append(' '.join(vals))
            elif name=='server_name':srv['server_name'].extend(vals)
            elif name=='ssl_certificate':srv['ssl_certificate'].extend(vals)
            elif name=='ssl_certificate_key':srv['ssl_certificate_key'].extend(vals)
            elif name=='proxy_protocol' and vals and vals[0]=='on':srv['proxy_protocol']=True
            elif name=='ssl_preread' and vals and vals[0]=='on':srv['ssl_preread']=True
            elif name=='proxy_pass':srv['proxy_pass'].extend(vals)
        elif mp and len(tokens)>=2:mp['entries'].append({'key':tokens[0].strip('"\''),'value':' '.join(x.strip('"\'') for x in tokens[1:])})
        elif ups and tokens[0]=='server' and len(tokens)>=2:ups['servers'].append(tokens[1].strip('"\''))
    elif delim=='}' and stack:
        ctx=stack.pop()
        if ctx['kind']=='server':servers.append(ctx)
        elif ctx['kind']=='map':maps.append(ctx)
        elif ctx['kind']=='upstream':upstreams.append(ctx)
def port_match(listen,port):
    first=listen.split()[0] if listen.split() else ''
    if first.isdigit():return int(first)==port
    m=re.search(r':(\d+)$',first.replace('[','').replace(']',''));return bool(m and int(m.group(1))==port)
result={'servers':servers,'maps':maps,'upstreams':upstreams,'http_80':any(s.get('protocol')=='http' and any(port_match(x,80) for x in s['listen']) for s in servers),'stream_80':any(s.get('protocol')=='stream' and any(port_match(x,80) for x in s['listen']) for s in servers),'http_443':any(s.get('protocol')=='http' and any(port_match(x,443) for x in s['listen']) for s in servers),'stream_443':any(s.get('protocol')=='stream' and any(port_match(x,443) for x in s['listen']) for s in servers),'stream_443_proxy_protocol':any(s.get('protocol')=='stream' and any(port_match(x,443) for x in s['listen']) and s.get('proxy_protocol') for s in servers),'stream_443_ssl_preread':any(s.get('protocol')=='stream' and any(port_match(x,443) for x in s['listen']) and s.get('ssl_preread') for s in servers)}
json.dump(result,sys.stdout,indent=2)
