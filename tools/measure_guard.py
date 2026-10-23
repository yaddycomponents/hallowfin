# Measure the guard's arm centre line (A-pose): bin sleeve vertices by |x| and
# average their height/depth, so the rig's joints sit where the mesh really is.
import bpy, sys
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    print('MESH', o.name, o.parent.name if o.parent else '-', len(o.data.vertices), [m.name for m in o.data.materials])

def verts(names):
    out = []
    for o in meshes:
        if any(o.data.materials) and o.data.materials[0] and o.data.materials[0].name in names:
            mw = o.matrix_world
            out += [mw @ v.co for v in o.data.vertices]
    return out

body = verts({'FABRIC_1_FRONT_1871.001'})
hand = verts({'Material.004'})
print('body z', min(v.z for v in body), max(v.z for v in body))
for side, sgn in (('R(-x)', -1), ('L(+x)', 1)):
    hs = [v for v in hand if v.x * sgn > 0.5]
    print(side, 'hand x', min(abs(v.x) for v in hs), max(abs(v.x) for v in hs), 'z', min(v.z for v in hs), max(v.z for v in hs))
    for i in range(4, 22):
        x0 = i * 0.1
        b = [v for v in body if x0 <= v.x * sgn < x0 + 0.1 and v.z > 2.9]
        if b:
            zs = sorted(v.z for v in b)
            print(f'  |x| {x0:.1f}  n {len(b):5d}  z {zs[0]:.2f}..{zs[-1]:.2f} mid {(zs[0]+zs[-1])/2:.2f}  y {sum(v.y for v in b)/len(b):.2f}')
# torso width at a few heights
for z in (2.6, 3.0, 3.4, 3.8, 4.2, 4.5, 4.8, 5.0):
    b = [v for v in body if abs(v.z - z) < 0.05 and abs(v.x) < 0.75]
    if b: print(f'torso z {z}: x {min(v.x for v in b):.2f}..{max(v.x for v in b):.2f}  y {min(v.y for v in b):.2f}..{max(v.y for v in b):.2f}')
