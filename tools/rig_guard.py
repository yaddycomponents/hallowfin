# Rig the pink guard (Sketchfab, static A-pose), give him a rifle and bake a
# shooting clip, all headless:
#   blender -b -P tools/rig_guard.py -- <in.glb> <out.glb>
#
# 1. Bones on the arm centre line measured by measure_guard.py (A-pose).
# 2. Meshes bound with automatic weights; both masks pinned to the head.
# 3. A rifle built from boxes; IK puts the hands on its grip and handguard.
# 4. Animate the rifle (low ready → aim → recoil), bake the arms, export.
# Blender is Z-up and the guard faces -Y; his right side is -X.
import bpy, sys, math
from mathutils import Vector, Matrix, Euler

src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.render.fps = 24

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
# flatten the Sketchfab hierarchy so every mesh sits in world space
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o)

# ── 1. the skeleton ────────────────────────────────────────────
arm = bpy.data.armatures.new('GuardRig')
rig = bpy.data.objects.new('Guard', arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None, connect=False):
    b = arm.edit_bones.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = connect
    return b

bone('hips', (0, 0.05, 2.75), (0, 0.05, 3.3))
bone('spine', (0, 0.05, 3.3), (0, 0.05, 4.0), 'hips', True)
bone('chest', (0, 0.05, 4.0), (0, 0.05, 4.75), 'spine', True)
bone('neck', (0, 0.05, 4.75), (0, 0.05, 5.0), 'chest', True)
bone('head', (0, 0.05, 5.0), (0, 0.05, 5.9), 'neck', True)
for s, side in ((-1, 'R'), (1, 'L')):
    bone(f'shoulder.{side}', (s * 0.15, 0.12, 4.6), (s * 0.72, 0.2, 4.5), 'chest')
    bone(f'upper_arm.{side}', (s * 0.72, 0.2, 4.5), (s * 1.28, 0.13, 3.93), f'shoulder.{side}', True)
    bone(f'forearm.{side}', (s * 1.28, 0.13, 3.93), (s * 1.85, -0.03, 3.5), f'upper_arm.{side}', True)
    bone(f'hand.{side}', (s * 1.85, -0.03, 3.5), (s * 2.07, -0.05, 3.33), f'forearm.{side}', True)
    bone(f'thigh.{side}', (s * 0.36, 0.05, 2.75), (s * 0.4, 0.0, 1.5), 'hips')
    bone(f'shin.{side}', (s * 0.4, 0.0, 1.5), (s * 0.42, 0.05, 0.35), f'thigh.{side}', True)
# arm bones roll so their local X is the elbow hinge (bend forward)
for side in ('R', 'L'):
    for n in ('upper_arm', 'forearm', 'hand'):
        arm.edit_bones[f'{n}.{side}'].align_roll(Vector((0, -1, 0)))
bpy.ops.object.mode_set(mode='OBJECT')

# ── 2. bind ────────────────────────────────────────────────────
masks = [o for o in meshes if o.data.materials and o.data.materials[0].name in ('black', 'Material.002', 'square', 'Material.001')
         and min((o.matrix_world @ v.co).z for v in o.data.vertices) > 4.8]
skin = [o for o in meshes if o not in masks]
bpy.ops.object.select_all(action='DESELECT')
for o in skin:
    o.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# heat weighting can leave stray vertices unweighted: give those to the nearest bone
def seg_dist(p, a, b):
    ab = b - a
    t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length
segs = [(b.name, rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in arm.bones]
fixed = 0
for o in skin:
    groups = {g.name: g for g in o.vertex_groups}
    for v in o.data.vertices:
        if sum(g.weight for g in v.groups) < 1e-3:
            p = o.matrix_world @ v.co
            name = min(segs, key=lambda s: seg_dist(p, s[1], s[2]))[0]
            g = groups.get(name) or o.vertex_groups.new(name=name)
            groups[name] = g
            g.add([v.index], 1.0, 'REPLACE')
            fixed += 1
print('unweighted vertices fixed:', fixed)

# both masks ride on the head bone; three.js shows one of them
for o in masks:
    mw = o.matrix_world.copy()
    o.parent = rig
    o.parent_type = 'BONE'
    o.parent_bone = 'head'
    o.matrix_world = mw

# ── 3. the rifle ───────────────────────────────────────────────
blk = bpy.data.materials.new('RifleBlack')
blk.use_nodes = True
bsdf = blk.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.03, 0.03, 0.035, 1)
bsdf.inputs['Metallic'].default_value = 0.6
bsdf.inputs['Roughness'].default_value = 0.45

parts = []
def box(size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    parts.append(o)
def cyl(r, depth, loc):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=(math.pi / 2, 0, 0), vertices=12)
    parts.append(bpy.context.object)
# along -Y from the butt at the origin
box((0.11, 0.5, 0.2), (0, -0.25, -0.03))           # stock
box((0.12, 0.72, 0.19), (0, -0.85, 0.0))           # receiver
box((0.08, 0.12, 0.27), (0, -0.66, -0.2), (math.radians(-18), 0, 0))   # pistol grip
box((0.08, 0.17, 0.36), (0, -1.0, -0.26), (math.radians(14), 0, 0))    # magazine
box((0.13, 0.55, 0.15), (0, -1.47, 0.01))          # handguard
box((0.04, 0.3, 0.06), (0, -0.95, 0.13))           # sight rail
cyl(0.032, 0.62, (0, -2.05, 0.02))                 # barrel
box((0.06, 0.06, 0.1), (0, -2.3, 0.06))            # front sight
for o in parts:
    o.data.materials.append(blk)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.join()
rifle = bpy.context.object
rifle.name = 'Rifle'
# the muzzle, as an empty three.js can find for the flash
muzzle = bpy.data.objects.new('Muzzle', None)
scene.collection.objects.link(muzzle)
muzzle.parent = rifle
muzzle.location = (0, -2.38, 0.02)

GRIP_R = Vector((0, -0.66, -0.2))   # pistol grip, in rifle space
GRIP_L = Vector((0, -1.47, -0.06))  # under the handguard

# IK: each hand reaches for its grip on the rifle
pb = rig.pose.bones
for side, grip in (('R', GRIP_R), ('L', GRIP_L)):
    t = bpy.data.objects.new(f'ik.{side}', None)
    scene.collection.objects.link(t)
    t.parent = rifle
    t.location = grip
    pole = bpy.data.objects.new(f'pole.{side}', None)
    scene.collection.objects.link(pole)
    pole.parent = rifle
    # elbows: right one out to the side, left one down under the handguard
    pole.location = Vector((-1.4, -0.4, -0.6)) if side == 'R' else Vector((1.2, -1.0, -1.4))
    c = pb[f'hand.{side}'].constraints.new('IK')
    c.target, c.chain_count = t, 3
    c.pole_target, c.pole_angle = pole, math.radians(-90)

# the shooter's stance: turned a little to his right, chest leaning into the gun
# (on an upright bone local Y runs along it, so Y is the twist; Z would bend him sideways)
pb['spine'].rotation_mode = 'XYZ'
pb['spine'].rotation_euler = (math.radians(4), math.radians(-10), 0)
pb['chest'].rotation_mode = 'XYZ'
pb['chest'].rotation_euler = (math.radians(6), math.radians(-10), 0)

# ── 4. animate: low ready → aim → recoil ──────────────────────
YAW = math.radians(26)  # the barrel crosses his body a little, toward his left
AIM = Matrix.Translation((-0.42, -0.28, 4.42)) @ Matrix.Rotation(YAW, 4, 'Z')
LOW = Matrix.Translation((-0.38, -0.35, 3.95)) @ Matrix.Rotation(YAW + math.radians(10), 4, 'Z') @ Matrix.Rotation(math.radians(38), 4, 'X')  # +X pitch tips the barrel (-Y) down
KICK = AIM @ Matrix.Translation((0, 0.14, 0.03)) @ Matrix.Rotation(math.radians(-7), 4, 'X')  # muzzle climbs
rifle.rotation_mode = 'QUATERNION'
for frame, m in ((0, LOW), (8, LOW), (22, AIM), (30, AIM), (32, KICK), (38, AIM), (60, AIM)):
    rifle.matrix_world = m
    rifle.keyframe_insert('location', frame=frame)
    rifle.keyframe_insert('rotation_quaternion', frame=frame)
scene.frame_start, scene.frame_end = 0, 60

# bake the IK into plain bone keys, then drop the helpers
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=0, frame_end=60, only_selected=True, visual_keying=True, clear_constraints=True, bake_types={'POSE'})
bpy.ops.object.mode_set(mode='OBJECT')
for o in [o for o in bpy.data.objects if o.name.startswith(('ik.', 'pole.'))]:
    bpy.data.objects.remove(o)

# report how close the hands got to the grips at full aim
scene.frame_set(30)
for side, grip in (('R', GRIP_R), ('L', GRIP_L)):
    hand = rig.matrix_world @ pb[f'hand.{side}'].tail
    print(f'hand.{side} miss at aim: {(hand - rifle.matrix_world @ grip).length:.3f}')

rifle.animation_data.action.name = 'Shoot'
rig.animation_data.action.name = 'Shoot'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='SCENE', export_skins=True, export_apply=False, export_yup=True)
print('exported', out)
