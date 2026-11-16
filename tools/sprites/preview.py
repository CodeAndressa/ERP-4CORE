from PIL import Image, ImageDraw
from sprites import SPRITES, PALETTE, W, H
S, G = 10, 12
cols, rows = 2, len(SPRITES)
IW = (W*S+G)*cols + G; IH = (H*S+G)*rows + G
img = Image.new("RGB", (IW,IH), "#2d0a57"); d = ImageDraw.Draw(img)
for r,(name,frames) in enumerate(SPRITES.items()):
    for c,grid in enumerate(frames):
        assert len(grid)==H, (name,c,len(grid))
        ox, oy = G + c*(W*S+G), G + r*(H*S+G)
        for y,line in enumerate(grid):
            assert len(line)==W, (name,c,y,len(line))
            for x,ch in enumerate(line):
                col = PALETTE[ch]
                if col: d.rectangle([ox+x*S, oy+y*S, ox+(x+1)*S-1, oy+(y+1)*S-1], fill=col)
img.save(r'C:/Users/ANDRES~1.SOA/AppData/Local/Temp/claude/C--Users-andressa-soares/a169b5a1-208c-4e3b-be7c-d7557bd1b90f/scratchpad/sprites.png')
print("ok")
