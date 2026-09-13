#!/usr/bin/env python3
from __future__ import annotations
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[1];path=root/'catalog'/'games.json'
try:data=json.loads(path.read_text())
except Exception as exc:print(f'catalog parse error: {exc}',file=sys.stderr);raise SystemExit(1)
games=data.get('games')
if not isinstance(games,list):print('catalog.games must be an array',file=sys.stderr);raise SystemExit(1)
errors=[];ids=set();game_ids=set();required=('id','gameId','title','system','core','rom')
def safe_rel(value):
    if not isinstance(value,str) or not value or value.startswith(('/','\\')):return False
    parts=value.replace('\\','/').split('/');return all(p not in ('','.','..') for p in parts)
for i,g in enumerate(games):
    prefix=f'games[{i}]'
    if not isinstance(g,dict):errors.append(f'{prefix}: must be an object');continue
    for key in required:
        if key not in g or g[key] in ('',None):errors.append(f'{prefix}: missing {key}')
    gid=g.get('id')
    if isinstance(gid,str):
        if gid in ids:errors.append(f'{prefix}: duplicate id {gid}')
        ids.add(gid)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,79}',gid):errors.append(f'{prefix}: id must be a lowercase slug')
    num=g.get('gameId')
    if num in game_ids:errors.append(f'{prefix}: duplicate gameId {num}')
    game_ids.add(num)
    if not safe_rel(g.get('rom')):errors.append(f'{prefix}: rom must be a safe relative path')
    bios=g.get('bios',[]);bios=[bios] if isinstance(bios,str) else bios
    if not isinstance(bios,list) or any(not safe_rel(x) for x in bios):errors.append(f'{prefix}: bios must be a safe string or array of relative paths')
    if 'screenshots' in g and not isinstance(g['screenshots'],list):errors.append(f'{prefix}: screenshots must be an array')
    if 'tags' in g and not isinstance(g['tags'],list):errors.append(f'{prefix}: tags must be an array')
if errors:print('\n'.join(errors),file=sys.stderr);raise SystemExit(1)
print(f'catalog OK: {len(games)} games')
