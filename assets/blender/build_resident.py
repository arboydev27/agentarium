"""Build the colonist: the rigged, animated alien resident.

Run: blender --background --factory-startup --python assets/blender/build_resident.py
Add `-- --preview DIR` to also render pose stills into DIR.

Everything here is original and deterministic: a segmented body on a 16-bone
skeleton, three expression and four silhouette shape keys, eight head
accessories, and twelve clips authored by a small analytic solver and exported
as named glTF animations. Blender is Z-up with the figure facing -Y, which the
exporter turns into Y-up facing +Z: the root sits on the floor at the chair's
front edge, and the desk is in front of it.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
FPS = 24

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.armatures):
    for item in list(block):
        block.remove(item)
bpy.context.scene.render.fps = FPS
# Clips are keyed from frame 0; the exporter clips to the scene range.
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 100000

# --- materials -------------------------------------------------------------
# Names are the runtime contract: World.tsx recolours suit, trim, skin and accent.


def material(name, color, rough=0.5, metallic=0.0, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


SUIT = material('colonist suit', (0.62, 0.56, 0.47), 0.62)
TRIM = material('colonist trim', (0.88, 0.84, 0.74), 0.55, 0.3)
SKIN = material('colonist skin', (0.62, 0.74, 0.70), 0.48)
EYE = material('colonist eye', (0.02, 0.03, 0.04), 0.12, 0.2, 0.25)
BOOT = material('colonist boot', (0.14, 0.15, 0.16), 0.8)
ACCENT = material('colonist accent', (0.86, 0.69, 0.43), 0.45, 0.2)
DARK = material('colonist dark', (0.19, 0.21, 0.26), 0.55)

# --- mesh helpers ----------------------------------------------------------


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def sphere(name, center, radii, mat, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=center)
    o = bpy.context.object
    o.name = name
    o.scale = radii
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    o.data.materials.append(mat)
    return smooth(o)


def tube(name, a, b, r0, r1, mat, verts=16):
    """A cone frustum from point a to point b."""
    a, b = Vector(a), Vector(b)
    axis = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=axis.length, location=(a + b) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(axis.normalized())
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    o.data.materials.append(mat)
    return smooth(o)


def box(name, center, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    o.data.materials.append(mat)
    return o


def cone(name, base, tip, r, mat, verts=8):
    return tube(name, base, tip, r, 0.002, mat, verts)


def torus(name, center, major, minor, mat, axis='Z'):
    bpy.ops.mesh.primitive_torus_add(location=center, major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8)
    o = bpy.context.object
    o.name = name
    if axis == 'Y':
        o.rotation_euler[0] = math.pi / 2
    if axis == 'X':
        o.rotation_euler[1] = math.pi / 2
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    o.data.materials.append(mat)
    return smooth(o)


def rotate(o, euler, pivot):
    """Rotate the mesh about `pivot` (vertex coordinates are armature-space)."""
    m = Matrix.Rotation(euler[2], 3, 'Z') @ Matrix.Rotation(euler[1], 3, 'Y') @ Matrix.Rotation(euler[0], 3, 'X')
    pivot = Vector(pivot)
    for v in o.data.vertices:
        v.co = pivot + m @ (v.co - pivot)
    return o


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    return o


def weight(o, bone, indices=None, value=1.0):
    group = o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)
    group.add(indices if indices is not None else [v.index for v in o.data.vertices], value, 'REPLACE')


def weight_by_height(o, stops):
    """Blend rigidly below the first stop and above the last; linearly in between.
    stops: [(z, bone), ...] ascending."""
    for z, bone in stops:
        o.vertex_groups.new(name=bone)
    for v in o.data.vertices:
        z = v.co.z
        if z <= stops[0][0]:
            o.vertex_groups[stops[0][1]].add([v.index], 1.0, 'REPLACE')
            continue
        if z >= stops[-1][0]:
            o.vertex_groups[stops[-1][1]].add([v.index], 1.0, 'REPLACE')
            continue
        for (z0, b0), (z1, b1) in zip(stops, stops[1:]):
            if z0 <= z <= z1:
                t = (z - z0) / (z1 - z0)
                t = t * t * (3 - 2 * t)
                o.vertex_groups[b0].add([v.index], 1 - t, 'REPLACE')
                o.vertex_groups[b1].add([v.index], t, 'REPLACE')
                break


# --- skeleton --------------------------------------------------------------
# (head, tail, parent, rest up). "up" is the bone's local +Z, used for roll.
FWD = Vector((0, -1, 0))
UP = Vector((0, 0, 1))
L, R = 1, -1
BONES = [
    ('Hips', (0, 0, 0.95), (0, 0, 1.08), None, FWD),
    ('Spine', (0, 0, 1.08), (0, 0, 1.25), 'Hips', FWD),
    ('Chest', (0, 0, 1.25), (0, 0, 1.42), 'Spine', FWD),
    ('Neck', (0, 0, 1.42), (0, 0, 1.50), 'Chest', FWD),
    ('Head', (0, 0, 1.50), (0, 0, 1.78), 'Neck', FWD),
]
for side, s in (('L', L), ('R', R)):
    BONES += [
        (f'UpperArm{side}', (s * 0.21, 0, 1.38), (s * 0.21, 0, 1.08), 'Chest', FWD),
        (f'LowerArm{side}', (s * 0.21, 0, 1.08), (s * 0.21, 0, 0.78), f'UpperArm{side}', FWD),
        (f'Hand{side}', (s * 0.21, 0, 0.78), (s * 0.21, 0, 0.64), f'LowerArm{side}', Vector((s, 0, 0))),
        (f'UpperLeg{side}', (s * 0.10, 0, 0.93), (s * 0.10, 0, 0.50), 'Hips', FWD),
        (f'LowerLeg{side}', (s * 0.10, 0, 0.50), (s * 0.10, 0, 0.09), f'UpperLeg{side}', FWD),
        (f'Foot{side}', (s * 0.10, 0, 0.09), (s * 0.10, -0.22, 0.02), f'LowerLeg{side}', UP),
    ]
ARM_UPPER, ARM_LOWER, HAND_LEN = 0.30, 0.30, 0.14
LEG_UPPER, LEG_LOWER = 0.43, 0.41

armature = bpy.data.armatures.new('ColonistRig')
rig = bpy.data.objects.new('Colonist', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for name, head, tail, parent, up in BONES:
    eb = armature.edit_bones.new(name)
    eb.head, eb.tail = Vector(head), Vector(tail)
    eb.align_roll(Vector(up))
    if parent:
        eb.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
REST = {b.name: b.matrix_local.copy() for b in armature.bones}
PARENT = {name: parent for name, _, _, parent, _ in BONES}
ORDER = [name for name, *_ in BONES]

# --- body ------------------------------------------------------------------
parts = []


def part(o, bone):
    weight(o, bone)
    parts.append(o)
    return o


def egg(o, center_z, radius_z, below=0.0, above=0.0):
    """Taper a sphere: scale x/y by (1 - below*t^2) under the centre and (1 + above*t) over it."""
    for v in o.data.vertices:
        t = (v.co.z - center_z) / radius_z
        f = 1 + above * t if t > 0 else 1 - below * t * t
        v.co.x *= f
        v.co.y *= f
    return o


# Torso: an egg broader at the shoulders, blended across hips, spine and chest.
torso = egg(sphere('torso', (0, 0, 1.17), (0.165, 0.105, 0.265), SUIT, 24, 16), 1.17, 0.265, 0.12, 0.22)
torso.data.name = 'torso'
weight_by_height(torso, [(1.00, 'Hips'), (1.12, 'Spine'), (1.30, 'Chest')])
torso.shape_key_add(name='Basis')
for key_name, factor in (('Broad', 1.16), ('Slender', 0.88)):
    key = torso.shape_key_add(name=key_name)
    for i, v in enumerate(torso.data.vertices):
        key.data[i].co = Vector((v.co.x * factor, v.co.y * factor, v.co.z))
parts.append(torso)

part(torus('belt', (0, 0, 0.985), 0.155, 0.018, DARK), 'Hips')
part(torus('collar ring', (0, 0, 1.425), 0.075, 0.016, TRIM), 'Chest')
part(box('chest panel', (0, -0.112, 1.30), (0.11, 0.03, 0.085), TRIM), 'Chest')
part(box('chest readout', (0, -0.129, 1.30), (0.07, 0.006, 0.045), EYE), 'Chest')
part(box('life support pack', (0, 0.135, 1.22), (0.21, 0.09, 0.25), TRIM), 'Chest')
part(box('pack vent', (0, 0.182, 1.22), (0.14, 0.01, 0.16), DARK), 'Chest')
part(tube('neck', (0, 0, 1.40), (0, 0, 1.52), 0.052, 0.045, SKIN, 14), 'Neck')

for side, s in (('L', L), ('R', R)):
    x = s * 0.21
    part(sphere('shoulder pad', (x, 0, 1.38), (0.072, 0.072, 0.066), TRIM, 16, 10), f'UpperArm{side}')
    part(tube('upper arm', (x, 0, 1.38), (x, 0, 1.08), 0.048, 0.042, SUIT), f'UpperArm{side}')
    part(sphere('elbow', (x, 0, 1.08), (0.05, 0.05, 0.05), DARK, 14, 10), f'LowerArm{side}')
    part(tube('forearm', (x, 0, 1.08), (x, 0, 0.78), 0.042, 0.036, SUIT), f'LowerArm{side}')
    part(torus('cuff', (x, 0, 0.80), 0.04, 0.012, TRIM), f'Hand{side}')
    part(sphere('mitten', (x, 0, 0.71), (0.024, 0.038, 0.072), SKIN, 14, 10), f'Hand{side}')
    part(sphere('thumb', (x - s * 0.02, -0.028, 0.745), (0.012, 0.014, 0.024), SKIN, 10, 8), f'Hand{side}')
    hx = s * 0.10
    part(sphere('hip joint', (hx, 0, 0.93), (0.07, 0.07, 0.07), DARK, 14, 10), f'UpperLeg{side}')
    part(tube('thigh', (hx, 0, 0.93), (hx, 0, 0.50), 0.062, 0.052, SUIT), f'UpperLeg{side}')
    part(sphere('knee', (hx, 0, 0.50), (0.055, 0.055, 0.055), DARK, 14, 10), f'LowerLeg{side}')
    part(tube('shin', (hx, 0, 0.50), (hx, 0, 0.12), 0.05, 0.042, SUIT), f'LowerLeg{side}')
    part(tube('boot cuff', (hx, 0, 0.19), (hx, 0, 0.09), 0.058, 0.06, BOOT, 14), f'Foot{side}')
    part(box('boot', (hx, -0.055, 0.055), (0.11, 0.27, 0.11), BOOT), f'Foot{side}')
    part(box('boot sole', (hx, -0.055, 0.008), (0.115, 0.28, 0.016), DARK), f'Foot{side}')

limbs = join([p for p in parts if p is not torso], 'limbs')
limbs.data.name = 'limbs'

# Head: an egg with a narrow jaw, large tilted eyes and a mouth; faces -Y.
HEAD_C, HEAD_R = 1.62, 0.17
dome = egg(sphere('dome', (0, 0, HEAD_C), (0.125, 0.135, HEAD_R), SKIN, 28, 18), HEAD_C, HEAD_R, 0.28, 0.0)
EYES = [(s * 0.056, -0.112, 1.625) for s in (L, R)]
eyes = []
for s, center in zip((L, R), EYES):
    eye = sphere('eye', center, (0.047, 0.02, 0.062), EYE, 14, 10)
    rotate(eye, (0, -s * 0.32, s * 0.12), center)
    eyes.append(eye)
mouth = box('mouth', (0, -0.126, 1.535), (0.052, 0.008, 0.011), DARK)
head = join([dome, *eyes, mouth], 'head')


def eye_of(co):
    for center in EYES:
        if (co - Vector(center)).length < 0.085 and co.y < -0.085:
            return Vector(center)
    return None


def is_mouth(co):
    return abs(co.x) < 0.045 and abs(co.z - 1.535) < 0.015 and co.y < -0.11


head.shape_key_add(name='Basis')
for key_name in ('Focused', 'Confused', 'Happy', 'TallCranium', 'WideHead'):
    key = head.shape_key_add(name=key_name)
    for i, v in enumerate(head.data.vertices):
        co = v.co.copy()
        eye = eye_of(co)
        if key_name == 'Focused':
            if eye:
                co.z = eye.z + (co.z - eye.z) * 0.5
            elif is_mouth(co):
                co.x *= 0.8
        elif key_name == 'Confused':
            if eye:
                if eye.x > 0:
                    co.z += 0.014
                    co.z = eye.z + 0.014 + (co.z - eye.z - 0.014) * 1.08
                else:
                    co.z = eye.z + (co.z - eye.z) * 0.6
            elif is_mouth(co):
                co.x += 0.012
                co.z += co.x * 0.25
        elif key_name == 'Happy':
            if eye:
                co.z = eye.z + (co.z - eye.z) * 0.68 + 0.006
            elif is_mouth(co):
                co.x *= 1.35
                co.z += 0.02 * (co.x / 0.034) ** 2 - 0.004
        elif key_name == 'TallCranium':
            if co.z > HEAD_C:
                co.z = HEAD_C + (co.z - HEAD_C) * 1.32
        elif key_name == 'WideHead':
            if not eye and not is_mouth(co):
                co.x *= 1.18
            else:
                co.x *= 1.14
        key.data[i].co = co
weight(head, 'Head')

# Accessories: one mesh each, all on the head bone; the runtime shows one per resident.
accessories = []


def accessory(name, builders):
    o = join([b() for b in builders], f'accessory-{name}')
    weight(o, 'Head')
    accessories.append(o)


accessory('sensor-pods', [
    lambda: torus('band', (0, 0, 1.70), 0.142, 0.011, DARK),
    *[lambda s=s: sphere('pod', (s * 0.142, 0.01, 1.70), (0.028, 0.034, 0.03), ACCENT, 12, 8) for s in (L, R)],
])
accessory('cranial-crest', [
    lambda i=i: cone('fin', (0, -0.07 + i * 0.045, 1.74 + 0.02 * (i in (1, 2))), (0, -0.06 + i * 0.045, 1.84 + 0.015 * (i in (1, 2))), 0.016, ACCENT, 6)
    for i in range(4)
])
accessory('antenna', [
    *[lambda s=s: tube('stalk', (s * 0.05, 0.01, 1.76), (s * 0.085, 0.0, 1.90), 0.006, 0.004, DARK, 8) for s in (L, R)],
    *[lambda s=s: sphere('tip', (s * 0.085, 0.0, 1.905), (0.014, 0.014, 0.014), ACCENT, 10, 8) for s in (L, R)],
])
accessory('compound-optics', [
    *[lambda c=c: torus('lens ring', (c[0], c[1] - 0.012, c[2]), 0.05, 0.008, ACCENT, 'Y') for c in EYES],
    lambda: box('bridge', (0, -0.128, 1.63), (0.04, 0.012, 0.012), ACCENT),
])
accessory('swept-horns', [
    lambda s=s: cone('horn', (s * 0.085, 0.02, 1.73), (s * 0.16, 0.08, 1.86), 0.022, ACCENT, 10) for s in (L, R)
])
accessory('ear-fins', [
    lambda s=s: rotate(box('fin', (s * 0.14, 0.015, 1.63), (0.016, 0.06, 0.1), ACCENT), (0, s * 0.3, 0), (s * 0.14, 0.015, 1.63)) for s in (L, R)
])
accessory('crystal-crown', [
    lambda k=k: cone('crystal', (0.062 * math.cos(k * 2 * math.pi / 5 + math.pi / 2), 0.062 * math.sin(k * 2 * math.pi / 5 + math.pi / 2), 1.765),
                     (0.085 * math.cos(k * 2 * math.pi / 5 + math.pi / 2), 0.085 * math.sin(k * 2 * math.pi / 5 + math.pi / 2), 1.86), 0.016, ACCENT, 6)
    for k in range(5)
])
accessory('visor', [
    lambda: box('visor', (0, -0.118, 1.625), (0.2, 0.02, 0.055), EYE),
    lambda: box('visor rim', (0, -0.11, 1.655), (0.21, 0.03, 0.01), ACCENT),
])

meshes = [torso, limbs, head, *accessories]
for o in meshes:
    o.parent = rig
    mod = o.modifiers.new('skin', 'ARMATURE')
    mod.object = rig

# --- pose solver -----------------------------------------------------------


def frame_matrix(origin, direction, up):
    """Armature-space bone matrix: local Y along the bone, local Z toward `up`."""
    y = Vector(direction).normalized()
    z = Vector(up) - Vector(up).dot(y) * y
    if z.length < 1e-6:
        z = Vector((1, 0, 0)) - y.x * y
    z.normalize()
    x = y.cross(z)
    o = Vector(origin)
    return Matrix(((x.x, y.x, z.x, o.x), (x.y, y.y, z.y, o.y), (x.z, y.z, z.z, o.z), (0, 0, 0, 1)))


def rot(pitch=0.0, yaw=0.0, roll=0.0):
    """Pitch leans forward (-Y), yaw turns left, roll tips the top toward +X."""
    return Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(-roll, 4, 'Y') @ Matrix.Rotation(pitch, 4, 'X')


def two_bone(origin, target, a, b, hint):
    """Return the middle joint of a two-bone chain, bent toward `hint`."""
    origin, target = Vector(origin), Vector(target)
    d = target - origin
    direction = d.normalized()
    if d.length >= a + b - 1e-6:
        # Fully extended: the chain is straight and the target is clamped to reach.
        return origin + direction * a, origin + direction * (a + b)
    dist = max(d.length, 1e-4)
    ca = (a * a + dist * dist - b * b) / (2 * dist)
    sa = math.sqrt(max(a * a - ca * ca, 0))
    perp = Vector(hint) - Vector(hint).dot(direction) * direction
    if perp.length < 1e-6:
        perp = Vector((0, 1, 0)) - direction.y * direction
    return origin + direction * ca + perp.normalized() * sa, origin + direction * dist


class Figure:
    """One frame of the figure as armature-space bone frames."""

    def __init__(self, hips=(0, 0, 0.95), hips_rot=(0, 0, 0), spine=(0, 0), chest=(0, 0), neck=0.0, head=(0, 0, 0)):
        self.frames = {}
        p = Vector(hips)
        r_h = rot(*hips_rot)
        r_s = r_h @ rot(spine[0], spine[1])
        r_c = r_s @ rot(chest[0], chest[1])
        r_n = r_c @ rot(neck)
        r_hd = r_n @ rot(*head)
        p_spine = p + r_h @ Vector((0, 0, 0.13))
        p_chest = p_spine + r_s @ Vector((0, 0, 0.17))
        p_neck = p_chest + r_c @ Vector((0, 0, 0.17))
        p_head = p_neck + r_n @ Vector((0, 0, 0.08))
        for name, origin, m in (('Hips', p, r_h), ('Spine', p_spine, r_s), ('Chest', p_chest, r_c), ('Neck', p_neck, r_n), ('Head', p_head, r_hd)):
            self.frames[name] = frame_matrix(origin, m @ UP, m @ FWD)
        self.shoulder = {s: p_chest + r_c @ Vector((s * 0.21, 0, 0.13)) for s in (L, R)}
        self.hip = {s: p + r_h @ Vector((s * 0.10, 0, -0.02)) for s in (L, R)}
        self.r_chest = r_c
        self.r_hips = r_h
        for s in (L, R):
            # Straight rest arm; clips call arm_hang/arm for anything else.
            self.arm(s, self.shoulder[s] + r_c @ Vector((0, 0, -(ARM_UPPER + ARM_LOWER))), r_c @ Vector((0, 1, 0)),
                     hand_dir=r_c @ Vector((0, 0, -1)), hand_up=(s, 0, 0))
            self.leg(s, (s * 0.10, 0, 0.09))

    def arm(self, s, wrist, hint=(0, 1, 0), hand_dir=None, hand_up=None):
        side = 'L' if s == L else 'R'
        shoulder = self.shoulder[s]
        elbow, wrist = two_bone(shoulder, wrist, ARM_UPPER, ARM_LOWER, hint)
        bend_up = -Vector(hint)
        self.frames[f'UpperArm{side}'] = frame_matrix(shoulder, elbow - shoulder, bend_up)
        self.frames[f'LowerArm{side}'] = frame_matrix(elbow, wrist - elbow, bend_up)
        direction = Vector(hand_dir) if hand_dir else (wrist - elbow)
        up = Vector(hand_up) if hand_up else Vector((s, 0, 0))
        self.frames[f'Hand{side}'] = frame_matrix(wrist, direction, up)

    def arm_hang(self, s, swing=0.0, flare=0.0, bend=0.08):
        """Relaxed arm: `swing` forward (radians), `flare` outward, slight elbow bend."""
        shoulder = self.shoulder[s]
        down = self.r_chest @ rot(-swing) @ Matrix.Rotation(-s * flare, 4, 'Y') @ Vector((0, 0, -1))
        wrist = shoulder + down * (ARM_UPPER + ARM_LOWER) * math.cos(bend)
        hint = self.r_chest @ Vector((s * 0.35, 1, 0))
        self.arm(s, wrist, hint, hand_dir=down, hand_up=(s, 0, 0))

    def leg(self, s, ankle, hint=(0, -1, 0.15), foot_dir=(0, -0.22, -0.07), foot_up=(0, 0, 1)):
        side = 'L' if s == L else 'R'
        hip = self.hip[s]
        knee, ankle = two_bone(hip, ankle, LEG_UPPER, LEG_LOWER, hint)
        bend_up = Vector(hint)
        self.frames[f'UpperLeg{side}'] = frame_matrix(hip, knee - hip, bend_up)
        self.frames[f'LowerLeg{side}'] = frame_matrix(knee, ankle - knee, bend_up)
        self.frames[f'Foot{side}'] = frame_matrix(ankle, foot_dir, foot_up)


def apply(figure, frame):
    pose = {}
    for name in ORDER:
        desired = figure.frames[name]
        parent = PARENT[name]
        if parent:
            chain = pose[parent] @ REST[parent].inverted() @ REST[name]
        else:
            chain = REST[name]
        pb = rig.pose.bones[name]
        pb.matrix_basis = chain.inverted() @ desired
        pose[name] = desired
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        if not parent:
            pb.keyframe_insert('location', frame=frame)


for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'

# Rest-pose self check: the solver's rest figure must reproduce the edit-mode bones.
rest = Figure()
deviations = {n: max(abs(v) for row in (rest.frames[n] - REST[n]) for v in row) for n in ORDER}
assert max(deviations.values()) < 1e-3, f'rest figure deviates from the armature: {deviations}'

# --- clips -----------------------------------------------------------------
TAU = 2 * math.pi
KEYBOARD = {s: (s * 0.18, -0.22, 1.10) for s in (L, R)}
KEY_HINT = (0, 0.55, -1)
HAND_ON_KEYS = (0, -0.14, -0.04)
SEAT = (0, 0.28, 0.62)
SEAT_ANKLE = {s: (s * 0.10, -0.18, 0.09) for s in (L, R)}
SEAT_KNEE_HINT = (0, -1, 0.6)


def breath(t, amount=0.02, cycles=2):
    return amount * math.sin(TAU * cycles * t)


def seated(t, lean=0.08, hips=SEAT):
    f = Figure(hips=hips, spine=(lean * 0.5, 0), chest=(lean * 0.5 + breath(t, 0.015), 0))
    for s in (L, R):
        f.leg(s, SEAT_ANKLE[s], SEAT_KNEE_HINT, (0, -0.22, -0.07))
    return f


def hands_on_keys(f, t, tap=0.0):
    for s in (L, R):
        x, y, z = KEYBOARD[s]
        lift = tap * max(0.0, math.sin(TAU * 3 * t + (0 if s == L else math.pi)))
        f.arm(s, (x, y, z + lift), KEY_HINT, HAND_ON_KEYS, (0, 0, 1))


def walking(t):
    f = Figure(hips=(0.012 * math.sin(TAU * t), 0, 0.93 - 0.02 * math.cos(2 * TAU * t)),
               hips_rot=(0.04, 0.09 * math.sin(TAU * t), 0.03 * math.sin(TAU * t)),
               spine=(0.02, -0.05 * math.sin(TAU * t)), chest=(0.0, -0.08 * math.sin(TAU * t)),
               head=(-0.03, 0.03 * math.sin(TAU * t), 0))
    for s in (L, R):
        phase = (t + (0 if s == L else 0.5)) % 1.0
        if phase < 0.5:
            y, z = -0.30 + 1.2 * phase, 0.09
            foot = (0, -0.22, -0.07)
        else:
            u = (phase - 0.5) * 2
            y, z = 0.30 - 0.60 * u, 0.09 + 0.13 * math.sin(math.pi * u)
            foot = (0, -0.22, -0.07 - 0.06 * math.sin(math.pi * u))
        f.leg(s, (s * 0.10, y, z), (0, -1, 0.15), foot)
        swing = (-1 if s == L else 1) * math.cos(TAU * t)
        f.arm_hang(s, swing=0.45 * swing, flare=0.06, bend=0.35 + 0.15 * max(0, swing))
    return f


def rest(t):
    f = Figure(hips_rot=(0, 0.02 * math.sin(TAU * t), 0.015 * math.sin(TAU * t)),
               spine=(breath(t, 0.012, 3), 0), chest=(breath(t, 0.018, 3), 0.04 * math.sin(TAU * t)),
               head=(0.02 * math.sin(TAU * 3 * t), 0.22 * math.sin(TAU * t), 0.03 * math.sin(TAU * t)))
    for s in (L, R):
        f.arm_hang(s, swing=0.03 * math.sin(TAU * t + s), flare=0.09 + 0.02 * math.sin(TAU * 3 * t), bend=0.14)
    return f


def thumbs_up(t):
    pump = max(0.0, math.sin(TAU * 2 * t))
    f = Figure(hips_rot=(-0.04, 0, 0), spine=(-0.05, 0), chest=(-0.08 - 0.04 * pump, -0.08), head=(-0.18 - 0.05 * pump, -0.1, 0.08))
    f.arm(R, (-0.27, -0.12, 1.72 + 0.08 * pump), (-0.4, 0.3, -0.6), (0, -0.25, 1), (0, 1, 0))
    f.arm(L, (0.25, -0.02, 0.96), (0.9, 0.5, -0.2), (-0.2, -0.3, -1), (1, 0, 0))
    return f


def desk_type(t):
    f = seated(t, lean=0.14)
    f.frames['Head'] = Figure(hips=SEAT, spine=(0.07, 0), chest=(0.07 + breath(t, 0.015), 0),
                              head=(0.12 + 0.02 * math.sin(TAU * 2 * t), 0.03 * math.sin(TAU * t), 0)).frames['Head']
    hands_on_keys(f, t, tap=0.03)
    return f


def desk_review(t):
    f = seated(t, lean=0.04)
    f.frames['Head'] = Figure(hips=SEAT, spine=(0.02, 0), chest=(0.02 + breath(t, 0.015), 0),
                              head=(0.06 + 0.03 * math.sin(TAU * 2 * t), 0.14 * math.sin(TAU * t), 0.02 * math.sin(TAU * t))).frames['Head']
    hands_on_keys(f, t)
    return f


def desk_wait(t):
    f = seated(t, lean=0.02)
    f.frames['Head'] = Figure(hips=SEAT, spine=(0.01, 0), chest=(0.01 + breath(t, 0.015), 0),
                              head=(-0.08, 0.1 * math.sin(TAU * t), 0.06)).frames['Head']
    x, y, z = KEYBOARD[L]
    f.arm(L, (x, y, z), KEY_HINT, HAND_ON_KEYS, (0, 0, 1))
    wave = math.sin(TAU * 2 * t)
    f.arm(R, (-0.40 + 0.03 * wave, -0.04, 1.40 + 0.02 * abs(wave)), (-0.3, 0.6, -0.9), (0.08 * wave, -0.05, 1), (0, 1, 0))
    return f


def desk_error(t):
    f = seated(t, lean=0.3)
    f.frames['Head'] = Figure(hips=SEAT, spine=(0.15, 0), chest=(0.15 + breath(t, 0.01, 1), 0),
                              head=(0.36, 0.05 * math.sin(TAU * t), -0.1)).frames['Head']
    hands_on_keys(f, t)
    return f


def bench_rest(t):
    hips = (0, 0.28, 0.69)
    f = Figure(hips=hips, spine=(-0.05, 0), chest=(-0.06 + breath(t, 0.015), 0.03 * math.sin(TAU * t)),
               head=(0.02, 0.2 * math.sin(TAU * t), 0.03 * math.sin(TAU * t)))
    for s in (L, R):
        f.leg(s, (s * 0.13, -0.26, 0.09), SEAT_KNEE_HINT, (0, -0.22, -0.07))
        f.arm(s, (s * 0.16, -0.05, 0.80 + 0.01 * math.sin(TAU * t + s)), (s * 0.5, 0.6, -1), (0, -0.15, -0.03), (0, 0, 1))
    return f


def cafe_break(t):
    sip = max(0.0, math.sin(TAU * t)) ** 2
    f = Figure(hips_rot=(0, 0, 0.02), spine=(0.02, 0), chest=(breath(t, 0.015, 3), 0.05),
               head=(-0.04 + 0.1 * sip, 0.12 * math.sin(TAU * t) - 0.1 * sip, 0.08 * sip))
    f.arm(R, (-0.07, -0.19 + 0.02 * sip, 1.36 + 0.09 * sip), (-0.6, 0.5, -0.8), (0.4, -0.3, 1), (0, 1, 0))
    f.arm_hang(L, swing=0.04, flare=0.1, bend=0.2)
    return f


def garden_look(t):
    f = Figure(spine=(0.01, 0.04 * math.sin(TAU * t)), chest=(breath(t, 0.015, 3), 0.1 * math.sin(TAU * t)),
               head=(-0.05 + 0.03 * math.sin(TAU * 2 * t), 0.36 * math.sin(TAU * t), 0.04 * math.sin(TAU * t)))
    for s in (L, R):
        f.arm(s, (s * 0.08, 0.15, 0.95), (s * 1, 0.3, -0.3), (-s * 0.6, 0.2, -0.3), (0, 1, 0))
    return f


def survey_sky(t):
    sweep = math.sin(TAU * t)
    f = Figure(hips_rot=(-0.03, 0, 0), spine=(-0.08, 0.03 * sweep), chest=(-0.14, 0.06 * sweep),
               head=(-0.5, 0.3 * sweep, 0.05 * sweep))
    f.arm(R, (-0.22 + 0.1 * sweep, -0.33, 1.66 + 0.03 * sweep), (-0.4, 0.6, -0.7), (0.1 * sweep, -0.45, 1), (0, 1, 0))
    f.arm_hang(L, swing=0.05, flare=0.12, bend=0.18)
    return f


def sample_scan(t):
    reach = (1 - math.cos(TAU * t)) / 2
    f = Figure(hips_rot=(0.12, 0, 0), spine=(0.22, 0), chest=(0.26 + breath(t, 0.01), 0.05),
               head=(0.3 + 0.1 * reach, 0.1 * math.sin(TAU * t), 0))
    f.arm(L, (0.16, -0.36, 0.62 - 0.05 * reach), (0.6, 0.6, -0.7), (0.1, -0.5, -1), (0, -1, 0.5))
    f.arm(R, (-0.17, -0.2, 0.72), (-0.7, 0.6, -0.5), (0, -0.4, -1), (-1, 0, 0))
    return f


CLIPS = [
    ('Walking', 1.0, walking),
    ('Rest', 6.0, rest),
    ('ThumbsUp', 2.0, thumbs_up),
    ('DeskType', 4.0, desk_type),
    ('DeskReview', 4.0, desk_review),
    ('DeskWait', 4.0, desk_wait),
    ('DeskError', 4.0, desk_error),
    ('BenchRest', 6.0, bench_rest),
    ('CafeBreak', 6.0, cafe_break),
    ('GardenLook', 6.0, garden_look),
    ('SurveySky', 6.0, survey_sky),
    ('SampleScan', 6.0, sample_scan),
]

anim = rig.animation_data_create()
for name, seconds, build in CLIPS:
    action = bpy.data.actions.new(name)
    anim.action = action
    anim.action_slot = action.slots.new(id_type='OBJECT', name=rig.name)
    frames = int(round(seconds * FPS))
    for frame in range(frames + 1):
        apply(build(frame / frames), frame)
    action.use_frame_range = True
    action.frame_range = (0, frames)
    track = anim.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    anim.action = None
# Leave the armature in its rest pose.
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)

# --- export ----------------------------------------------------------------
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in meshes:
    o.select_set(True)
out = ROOT / 'public/models/resident'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(out / 'colonist.glb'), export_format='GLB', use_selection=True, export_yup=True,
    export_apply=False, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_frame_range=True, export_anim_slide_to_zero=True, export_optimize_animation_size=False,
    export_skins=True, export_morph=True, export_morph_normal=False, export_def_bones=False,
    export_rest_position_armature=True,
)
(out / 'manifest.json').write_text(json.dumps({
    'source': 'assets/blender/colonist.blend',
    'generator': 'assets/blender/build_resident.py',
    'units': 'metres',
    'front': '+Z in glTF',
    'height': 1.79,
    'clips': [name for name, *_ in CLIPS],
    'expressions': ['Focused', 'Confused', 'Happy'],
    'silhouettes': ['TallCranium', 'WideHead', 'Broad', 'Slender'],
    'accessories': [o.name for o in accessories],
}, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/colonist.blend'))

# --- optional preview renders ----------------------------------------------
if '--preview' in sys.argv:
    preview = Path(sys.argv[sys.argv.index('--preview') + 1])
    preview.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    # The NLA tracks would otherwise drive the pose; previews pose the bones directly.
    for track in anim.nla_tracks:
        track.mute = True
    scene.frame_set(0)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 640, 800
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('preview') if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.45, 0.4, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    bpy.ops.object.light_add(type='SUN', location=(3, -4, 6))
    sun = bpy.context.object
    sun.rotation_euler = (0.9, 0.3, 0.6)
    sun.data.energy = 3
    bpy.ops.object.camera_add(location=(1.9, -3.2, 1.6), rotation=(1.38, 0, 0.53))
    camera = bpy.context.object
    camera.data.lens = 45
    scene.camera = camera
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    bpy.context.object.data.materials.append(material('ground', (0.45, 0.3, 0.2), 0.9))
    for o in accessories:
        o.hide_render = o.name != 'accessory-antenna'
    shots = [('Rest', 0.3), ('Walking', 0.2), ('DeskType', 0.4), ('DeskWait', 0.6), ('ThumbsUp', 0.3), ('BenchRest', 0.5), ('SurveySky', 0.3), ('SampleScan', 0.5), ('GardenLook', 0.25), ('CafeBreak', 0.3), ('DeskError', 0.5)]
    for name, t in shots:
        _, seconds, build = next(c for c in CLIPS if c[0] == name)
        for pb in rig.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        figure = build(t)
        pose = {}
        for bone in ORDER:
            parent = PARENT[bone]
            chain = (pose[parent] @ REST[parent].inverted() @ REST[bone]) if parent else REST[bone]
            rig.pose.bones[bone].matrix_basis = chain.inverted() @ figure.frames[bone]
            pose[bone] = figure.frames[bone]
        scene.render.filepath = str(preview / f'{name}.png')
        bpy.ops.render.render(write_still=True)
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
