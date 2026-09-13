#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; PRESET="$ROOT_DIR/catalog/presets/curated-classics.json"; CATALOG="$ROOT_DIR/catalog/games.json"; MODE="${1:-installed}"
MODE="$MODE" ROOT_DIR="$ROOT_DIR" PRESET="$PRESET" CATALOG="$CATALOG" python3 - <<'PY'
import json,os,pathlib,tempfile
root=pathlib.Path(os.environ['ROOT_DIR']);preset=json.loads(pathlib.Path(os.environ['PRESET']).read_text())['games'];path=pathlib.Path(os.environ['CATALOG']);data=json.loads(path.read_text());games=data.setdefault('games',[]);by_id={g.get('id'):g for g in games};mode=os.environ['MODE'];added=updated=skipped=0
for g in preset:
    rom=(root/'games/roms'/g['rom']).is_file();cover=(root/'public'/g['cover'].lstrip('/')).is_file();bios=g.get('bios',[]);bios=[bios] if isinstance(bios,str) else bios;ready=rom and cover and all((root/'games/bios'/b).is_file() for b in bios)
    if mode!='all' and not ready:skipped+=1;continue
    item=dict(g)
    if mode=='all':item['listedWhenMissing']=True
    if item['id'] in by_id:by_id[item['id']].update(item);updated+=1
    else:games.append(item);by_id[item['id']]=item;added+=1
text=json.dumps(data,ensure_ascii=False,indent=2)+'\n';fd,tmp=tempfile.mkstemp(prefix='games.',suffix='.json',dir=str(path.parent));f=os.fdopen(fd,'w');f.write(text);f.close();os.replace(tmp,path);print(f'Curated classics sync: added={added}, updated={updated}, skipped={skipped}')
PY
"$ROOT_DIR/scripts/catalog-check.py"
