"""Original Agentarium expedition habitat kit. Run with Blender --background --python this_file.
Coordinates: metres, Blender Z up; entrance faces -Y (glTF +Z).
Textures are deterministic authored procedural images, packed into the .blend and GLB.
"""
import bpy, math, random, json, struct, zlib
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models/habitat'
TEX = ROOT / 'public/textures/habitat'
OUT.mkdir(parents=True, exist_ok=True); TEX.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(2710)
N=512
rng=np.random.default_rng(2710)
y,x=np.mgrid[0:N,0:N].astype(np.float32)/N
# Periodic multiscale grain avoids tile seams, with independent fine pore noise.
def field(seed):
    r=np.random.default_rng(seed); f=np.zeros((N,N),np.float32)
    for frequency,amp in [(2,.38),(5,.22),(13,.13),(31,.07),(79,.035)]:
        for _ in range(3):
            a=int(r.integers(1,frequency+1)); b=int(r.integers(1,frequency+1))
            f += amp/3*np.sin(2*math.pi*(a*x+b*y)+r.random()*6.28)
    return f
noise=field(31); fine=rng.random((N,N)).astype(np.float32)-.5

def image(name, values, color=False):
    im=bpy.data.images.new(name,width=N,height=N,alpha=True)
    rgba=np.ones((N,N,4),np.float32)
    if values.ndim==2: rgba[:,:,:3]=values[:,:,None]
    else: rgba[:,:,:3]=values
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    im.pixels.foreach_set(np.clip(rgba,0,1).ravel())
    im.update()
    assert max(im.pixels[:3]) > 0.1, 'Texture buffer is empty: '+name
    im.filepath_raw=str(TEX/(name+'.png')); im.file_format='PNG'; im.save()
    # Keep the deterministic authoring origin with both loose and packed textures.
    png=Path(im.filepath_raw); raw=png.read_bytes()
    origin=('impeccable:prompt\0Origin: original deterministic procedural '+name+
            ' texture; assets/blender/build_habitat.py, seed 2710; no external source.').encode()
    chunk=b'tEXt'+origin
    png.write_bytes(raw[:33]+struct.pack('>I',len(origin))+chunk+struct.pack('>I',zlib.crc32(chunk)&0xffffffff)+raw[33:])
    im.pack()
    return im

def pbr(name, base, kind, metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    grain=noise*.12+fine*.045
    if kind=='sand':
        ripples=np.sin(2*math.pi*(y*38+np.sin(x*math.pi*4)*.18))
        height=noise*.22+fine*.12+ripples*.035
        rgb=np.array(base)[None,None,:]+grain[:,:,None]+ripples[:,:,None]*.018
        rough=np.clip(.9+noise*.08,0,1)
    elif kind=='metal':
        scratches=(rng.random((N,N))>.997).astype(np.float32)
        for k in range(1,13): scratches=np.maximum(scratches,np.roll(scratches,k,axis=1)*(.98**k))
        chipped=(noise+fine*.12>.31).astype(np.float32)
        rgb=np.array(base)[None,None,:]+grain[:,:,None]*.35-scratches[:,:,None]*.16-chipped[:,:,None]*.2
        height=fine*.015-scratches*.025; rough=np.clip(.44+noise*.25+scratches*.32,.25,.92)
    else:
        pores=(rng.random((N,N))>.985).astype(np.float32)
        height=noise*.32+fine*.12-pores*.15
        rgb=np.array(base)[None,None,:]+grain[:,:,None]*1.7-pores[:,:,None]*.08
        rough=np.clip(.88+noise*.12,.6,1)
    color=image(name+'-color',rgb,True); roughtex=image(name+'-roughness',rough)
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*2.8
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*2.8
    normal=np.stack([-dx,-dy,np.ones_like(dx)],axis=2); normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    norm=image(name+'-normal',normal*.5+.5)
    nodes=m.node_tree.nodes; links=m.node_tree.links; bs=nodes.get('Principled BSDF')
    bs.inputs['Metallic'].default_value=metal
    for tex,slot in [(color,'Base Color'),(roughtex,'Roughness')]:
        node=nodes.new('ShaderNodeTexImage'); node.image=tex; links.new(node.outputs['Color'],bs.inputs[slot])
    node=nodes.new('ShaderNodeTexImage');node.image=norm
    nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.16 if kind=='metal' else .55
    links.new(node.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    return m
shell=pbr('ceramic-paint',[.72,.69,.59],'metal',.25)
metal=pbr('dusty-alloy',[.24,.28,.30],'metal',.75)
concrete=pbr('cast-foundation',[.38,.34,.29],'rock')
rock=pbr('ironstone',[.36,.19,.12],'rock')
sand=pbr('regolith',[.62,.31,.16],'sand')
def plain(name,color,metallic=0,rough=.5,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metallic;b.inputs['Roughness'].default_value=rough
    if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    return m
orange=plain('oxidized safety enamel',(.65,.19,.055),.25,.58)
glass=plain('blue reflective glazing',(.045,.15,.19),.7,.18)
light=plain('airlock navigation light',(.38,.9,.85),.15,.25,2)
black=plain('seal rubber',(.025,.032,.035),0,.85)

def finish(o,name,mat,bevel=0):
    o.name=name;o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('manufactured edge radii','BEVEL');mod.width=bevel;mod.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted panel normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,pos,size,mat,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)
def cyl(name,pos,r,depth,mat,axis='Z',verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=pos)
    o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    finish(o,name,mat,.025)
    for p in o.data.polygons:p.use_smooth=True
    return o

def pipe(name,points,r,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=3
    sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    return o

def text(body,pos,size,mat):
    c=bpy.data.curves.new('stencil '+body,'FONT');c.body=body;c.size=size;c.extrude=.001;c.align_x='CENTER'
    o=bpy.data.objects.new('stencil '+body,c);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(math.pi/2,0,0);c.materials.append(mat)
    return o
# A segmented pressure vessel, grounded by structural skids and cast footings.
for xx in [-2.8,2.8]:
    for yy in [-1.65,1.65]:box('cast footing',(xx,yy,.16),(1.25,1.1,.55),concrete,.12)
    box('load-bearing skid',(xx,0,.52),(.35,4.6,.3),metal)
box('insulated pressure hull',(0,0,2.5),(7.2,4.35,3.75),shell,.85)
box('dust skirt',(0,0,.83),(7.35,4.4,.3),metal,.14)
# External ribs give form and actual shadow, rather than painted lines alone.
for xx in [-3.1,-1.55,0,1.55,3.1]:
    pts=[(xx,-2.19,1),(xx,-2.22,2.7),(xx,-1.65,4.15),(xx,0,4.42),(xx,1.65,4.15),(xx,2.22,2.7),(xx,2.19,1)]
    pipe('pressure rib',pts,.065,metal)
for xx in [-2.5,2.5]:
    box('window gasket',(xx,-2.18,2.9),(1.1,.13,.85),black,.18)
    box('glazed port',(xx,-2.26,2.9),(.94,.06,.68),glass,.15)
    box('window eyebrow',(xx,-2.34,3.4),(1.3,.35,.08),shell,.03)
# Projecting airlock module, door, rails, steps and keypad.
box('airlock pressure vestibule',(0,-2.7,1.9),(2.1,1.6,2.7),shell,.32)
box('airlock recessed seal',(0,-3.53,1.92),(1.65,.14,2.25),black,.22)
for xx in [-.39,.39]:box('split airlock door',(xx,-3.63,1.92),(.76,.12,2.08),metal,.15)
box('door inspection slot',(0,-3.71,2.4),(.83,.04,.24),glass)
box('airlock light',(0,-3.57,3.18),(1.35,.1,.055),light,.015)
for xx in [-.88,.88]:box('safety door jamb',(xx,-3.62,1.9),(.07,.06,1.7),orange,.01)
box('access keypad',(1.16,-3.4,2.0),(.25,.16,.4),metal)
box('keypad display',(1.16,-3.49,2.07),(.18,.025,.12),light,.01)
for i in range(3):box('entry tread',(0,-3.7-i*.36,.55-i*.14),(2.2,.6,.15),metal,.02)
for side in [-1,1]:
    pipe('entry handrail',[(side*1.12,-3.5,1.5),(side*1.12,-4.35,1.0)],.045,metal)
    cyl('rail upright',(side*1.12,-4.3,.58),.04,.8,metal)
text('KEPLER / 07',(0,-2.235,3.82),.28,metal)
text('EXPEDITION HABITAT',(0,-3.56,3.4),.105,metal)
# End-cap access panels, vents, service piping.
for yy in [-1.15,0,1.15]:
    box('end service panel',(3.61,yy,2.2),(.1,.9,1.55),metal,.08)
    for zz in [1.65,1.85,2.05,2.25,2.45]:box('vent fin',(3.68,yy,zz),(.12,.72,.045),black,.01)
for xx in [-2.7,2.7]:
    pipe('external coolant line',[(xx,2.23,1.1),(xx,2.35,3.3),(xx+(.6 if xx<0 else -.6),2.35,3.7)],.09,metal)
for xx in [-2.1,-.7,.7,2.1]:
    box('roof radiator',(xx,.2,4.38),(1.1,1.8,.12),metal,.05)
    for yy in np.arange(-.6,1,.22):box('radiator channel',(xx,float(yy),4.46),(.95,.055,.045),black,.006)
# Separate modular equipment stored as named objects in the source kit.
for xx,yy in [(5.0,.6),(5.0,2.0)]:
    cyl('oxygen reservoir',(xx,yy,1.25),.48,2.05,shell)
    for zz in [.45,1.95]:cyl('reservoir band',(xx,yy,zz),.5,.1,metal)
    cyl('valve stem',(xx,yy,2.4),.08,.3,metal)
    box('reservoir plinth',(xx,yy,.15),(1.1,1.1,.3),concrete)
pipe('umbilical coolant hose',[(3.5,1.6,.6),(4.0,2.5,.22),(5.2,2.8,.22),(5.0,2.0,1.2)],.075,black)
for xx,yy,zz in [(-4.9,1.8,.45),(-4.9,.6,.45),(-4.9,1.8,1.2)]:
    box('field equipment crate',(xx,yy,zz),(1.1,.9,.7),metal,.09)
    for offset in [-.36,.36]:box('crate protective strap',(xx+offset,yy,zz),(.07,.94,.74),orange,.01)
# Small rock kit with real irregular geometry and UVs, placed off the arrival corridor.
for i,(xx,yy) in enumerate([(-5.8,-1.8),(-5.1,-2.5),(5.8,3.4),(4.8,4.3),(-4.2,4.5)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(xx,yy,.18))
    o=bpy.context.object;o.scale=(.65+random.random()*.5,.45+random.random()*.4,.4+random.random()*.3)
    for v in o.data.vertices:v.co*=.8+random.random()*.35
    finish(o,'eroded ironstone '+str(i),rock)
    bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project();bpy.ops.object.mode_set(mode='OBJECT')
# Bolts on shell and access panel corners; shared low-poly geometry in export.
for xx in [-3.05,-1.5,1.5,3.05]:
    for zz in [1.15,3.65]:cyl('flush fastener',(xx,-2.19,zz),.045,.055,metal,'Y',8)
# Wind deposits gather against equipment and foundations.
for xx,yy in [(-3.2,-1.8),(3.2,-1.8),(4.9,.65),(-4.9,1.7)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=8,radius=1,location=(xx,yy,.04))
    o=bpy.context.object;o.scale=(.85,.5,.16);finish(o,'accumulated windblown dust',sand)
# Collect export geometry before adding preview-only studio setup.
asset_objects=list(bpy.context.scene.objects)
for o in asset_objects:
    if o.type in {'CURVE','FONT'}:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
# Preserve editable named kit pieces in the source; join export copies by material.
# This cuts runtime draw calls without flattening the authoring workflow.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/expedition-habitat.blend'))
export_objects=[]
for material in [m for m in bpy.data.materials if m.users]:
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for source in asset_objects:
        if source.type!='MESH' or not source.data.materials or source.data.materials[0]!=material:continue
        obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj)
        obj.select_set(True);copies.append(obj)
    if copies:
        bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
        result=bpy.context.object;result.name='habitat / '+material.name;export_objects.append(result)
bpy.ops.object.select_all(action='DESELECT')
for obj in export_objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'expedition-habitat.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
manifest={'asset':'expedition-habitat.glb','source':'assets/blender/expedition-habitat.blend','generator':'assets/blender/build_habitat.py','units':'metres','up':'Y in glTF, Z in Blender','front':'+Z in glTF','authoringObjects':len(asset_objects),'runtimeMeshes':len(export_objects),'materials':sorted({m.name for o in export_objects for m in o.data.materials if m}), 'textures':'Original deterministic periodic procedural images, seed 2710; no external asset dependencies.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('HABITAT_EXPORT_COMPLETE',str(OUT/'expedition-habitat.glb'))
