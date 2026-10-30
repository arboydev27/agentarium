"""Build shared colony hardware. Also regenerates the reference habitat/material library.
Run: blender --background --factory-startup --python assets/blender/build_world_kit.py
"""
import runpy
from pathlib import Path
kit_script = Path(__file__).resolve()
globals().update(runpy.run_path(str(kit_script.with_name('build_habitat.py'))))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
roots=[]
def module(name, build):
    before=set(bpy.data.objects)
    build()
    objects=list(set(bpy.data.objects)-before)
    root=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(root)
    for o in objects:
        if o.parent is None: o.parent=root
    roots.append(root)

def pressure():
    cyl('cast circular raft',(0,0,.2),3.1,.4,concrete)
    # Retain the route-tested dome envelope; ribbed panels replace the smooth cap.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=2.8,location=(0,0,.4))
    o=bpy.context.object
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z < -.001],context='VERTS')
    bm.to_mesh(o.data);bm.free();finish(o,'insulated dome',shell)
    for i in range(12):
        angle=i*math.pi/6
        pts=[(math.cos(angle)*2.82*math.sin(t*math.pi/2),math.sin(angle)*2.82*math.sin(t*math.pi/2),.4+2.82*math.cos(t*math.pi/2)) for t in [0,.2,.4,.6,.8,1]]
        pipe('pressure seam',pts,.035,metal)
    box('airlock housing',(0,-2.3,1.1),(1.7,1.5,2),shell,.22)
    box('door gasket',(0,-3.065,1.1),(1.22,.06,1.65),black,.1)
    for x in [-.29,.29]: box('split door',(x,-3.11,1.1),(.55,.055,1.5),metal,.06)
    box('airlock transom',(0,-3.15,1.65),(.85,.035,.08),light,.01)
    for x in [-.72,.72]:
        box('safety marking',(x,-3.1,1.15),(.055,.03,1.3),orange,.01)
    for a in [0,math.pi/2,math.pi]:
        x,y=2.4*math.cos(a),2.4*math.sin(a)
        panel=box('service access',(x,y,1.2),(.7,.12,.55),metal,.05);panel.rotation_euler[2]=a-math.pi/2
    cyl('roof vent',(0,0,3.25),.35,.18,metal)
    for i in range(4): cyl('vent baffle',(0,0,3.34+i*.07),.28,.035,metal)

def solar():
    for x in [-1.4,1.4]:
        box('anchor shoe',(x,0,.08),(.5,.55,.16),concrete,.04)
        cyl('rack post',(x,0,.83),.07,1.5,metal)
        for y in [-.17,.17]: cyl('anchor bolt',(x,y,.18),.035,.06,metal)
    # Tilt is authored into the complete panel assembly, including cell wiring.
    before=set(bpy.data.objects)
    box('panel tray',(0,0,0),(4.2,2.2,.12),shell)
    for x in [-1.5,-.5,.5,1.5]:
        box('photovoltaic pane',(x,0,.08),(.91,2,.035),glass,.01)
        for j in range(10): box('cell busbar',(x,-.9+j*.2,.102),(.87,.008,.006),metal,.001)
    for x in [-2.06,2.06]: box('tray edge',(x,0,.12),(.07,2.2,.12),metal,.02)
    frame=bpy.data.objects.new('inclined panel assembly',None);bpy.context.collection.objects.link(frame)
    for o in set(bpy.data.objects)-before:
        if o!=frame:o.parent=frame
    frame.rotation_euler[0]=.3;frame.location.z=1.65
    box('inverter',(0,0,.55),(.6,.32,.7),metal)
    pipe('power conduit',[(0,0,.5),(.5,0,.18),(1.4,0,.12)],.025,black)

def sensor():
    cyl('sensor footing',(0,0,.15),.55,.3,concrete)
    cyl('telescopic mast',(0,0,2),.11,4,shell)
    for h in [.45,1.5,2.8,3.5]:cyl('mast collar',(0,0,h),.145,.1,metal)
    box('sensor crossbar',(0,0,3.6),(2.1,.18,.14),metal)
    for x in [-.9,.9]:
        box('instrument head',(x,0,3.7),(.32,.32,.3),shell)
        cyl('optical sensor',(x,-.18,3.7),.09,.06,glass,axis='Y')
    cyl('navigation beacon',(0,0,4),.16,.18,light)
    box('service box',(0,-.16,.8),(.3,.2,.42),metal)
    pipe('mast cable',[(.13,0,.25),(.13,0,2),(.13,0,3.55),(.8,0,3.55)],.018,black)

def service_wall():
    # Unit-width wall stretches only along X; keep the inhabited aisle open.
    box('insulated spine',(0,0,1.8),(10,.6,3.6),shell,.2)
    box('service plinth',(0,-.34,.45),(9.6,.16,.65),metal)
    box('sun canopy',(0,-.7,3.45),(10.3,1.9,.35),shell,.14)
    box('canopy luminaire',(0,-1.67,3.23),(9.5,.035,.035),light,.01)
    for x in [-3,0,3]:
        box('window gasket',(x,-.34,1.95),(2.4,.12,1.45),black,.12)
        box('pressure glazing',(x,-.42,1.95),(2.1,.04,1.12),glass,.1)
        box('window mullion',(x,-.46,1.95),(.045,.04,1.12),metal,.01)
        box('access panel',(x,-.37,.7),(1.7,.12,.55),metal,.04)
        for dx in [-.73,.73]:
            for h in [.5,.9]:cyl('panel fastener',(x+dx,-.45,h),.025,.03,orange,axis='Y',verts=12)
    for x in [-4.84,4.84]:box('end rib',(x,-.72,1.7),(.32,1.5,3.4),metal,.1)
    pipe('overhead conduit',[(-4.6,.34,2.8),(0,.34,2.8),(4.6,.34,2.8)],.07,metal)
    for x in [-4,-2,0,2,4]:box('roof radiator',(x,0,3.68),(1.4,.48,.09),metal,.02)
    cyl('roof exhaust',(3,0,4.05),.24,.8,metal)
    cyl('antenna',(3,0,4.7),.035,1.1,metal)

def resource_tank():
    cyl('tank raft',(0,0,.08),.52,.16,concrete)
    cyl('pressure vessel',(0,0,.75),.42,1.2,shell)
    for h in [.28,1.22]:cyl('vessel strap',(0,0,h),.46,.1,metal)
    cyl('valve neck',(0,0,1.43),.1,.2,metal)
    cyl('valve wheel',(0,0,1.55),.2,.04,orange)
    pipe('outlet pipe',[(.25,0,.35),(.58,0,.35),(.58,0,.05)],.07,metal)
    box('readout',(0,-.43,.9),(.26,.06,.22),black,.025)
    box('status strip',(0,-.47,.9),(.17,.02,.045),light,.005)

def rover():
    box('rover chassis',(0,0,.65),(1.6,2.4,.45),shell,.15)
    box('instrument cabin',(0,.3,1.06),(1.1,1.1,.5),shell,.1)
    box('cabin glazing',(0,-.27,1.1),(.9,.04,.3),glass,.035)
    for x in [-.87,.87]:
        for y in [-.85,0,.85]:
            cyl('wheel',(x,y,.35),.35,.22,black,axis='X')
            cyl('hub',(x+(.12 if x>0 else -.12),y,.35),.16,.04,metal,axis='X')
            for i in range(12):
                a=i*math.pi/6
                tread=box('wheel tread',(x,y+math.sin(a)*.35,.35+math.cos(a)*.35),(.24,.055,.045),metal,.01)
                tread.rotation_euler[0]=-a
        pipe('suspension',[(x,.9,.5),(x,0,.72),(x,-.9,.5)],.04,metal)
    cyl('sensor pole',(.5,.8,1.7),.04,1.8,metal)
    box('stereo camera',(.5,.8,2.6),(.4,.25,.18),shell)
    for x in [.38,.62]:cyl('stereo lens',(x,.66,2.6),.055,.035,glass,axis='Y')
    for x in [-.55,.55]:box('headlamp',(x,-1.22,.73),(.22,.04,.12),light,.02)
    for y in [-.8,-.55,-.3]:box('deck slat',(0,y,.9),(1.15,.08,.05),metal,.01)
    pipe('power harness',[(-.6,.9,.9),(-.6,.4,1.3),(-.4,.4,1.3)],.025,black)

def rocket():
    cyl('rocket pressure body',(0,0,3.8),.74,4.8,shell)
    for h,mat in [(1.65,metal),(2.3,orange),(5.4,metal)]:cyl('stage collar',(0,0,h),.76,.24,mat)
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.74,radius2=.03,depth=1.3,location=(0,0,6.8));finish(bpy.context.object,'ogive nose',shell)
    cyl('engine bell',(0,0,1.2),.45,.45,metal)
    for i in range(4):
        a=i*math.pi/2
        fin=box('stabilizer',(math.cos(a)*.83,math.sin(a)*.83,1.75),(.25,.65,1.8),metal,.04)
        fin.rotation_euler[2]=a
        pipe('fuel raceway',[(math.cos(a)*.75,math.sin(a)*.75,2.6),(math.cos(a)*.75,math.sin(a)*.75,5.1)],.025,metal)
    text('N / 07',(0,-.755,4.25),.25,black)
    for h in [3.1,4.8]:
        for i in range(12):
            a=i*math.pi/6;cyl('circumferential rivet',(math.cos(a)*.742,math.sin(a)*.742,h),.02,.03,metal,verts=8)

def gantry():
    for x in [-.24,.24]:
        for y in [-.3,.3]:box('gantry chord',(x,y,4.2),(.1,.1,8.4),metal,.02)
    for h in [1,2,3,4,5,6,7,8]:
        box('gantry rung',(0,-.31,h),(.5,.06,.07),orange,.015)
        pipe('truss diagonal',[(-.24,.3,h-.8),(.24,.3,h)],.045,metal)
    for h in [2,4,6,8]:box('umbilical arm',(.95,0,h),(2.2,.45,.2),metal)
    pipe('fuel supply',[(0,0,.1),(0,0,6.2),(1.85,0,6.2)],.075,black)

def cabin():
    box('control foundation',(0,0,.1),(3.2,2.7,.2),concrete)
    box('control cabin',(0,0,1.1),(3.2,2.7,2.2),shell,.3)
    box('control glazing',(0,-1.38,1.35),(2.5,.08,.8),glass,.05)
    for x in [-.85,0,.85]:box('glazing divider',(x,-1.43,1.35),(.055,.04,.8),metal,.01)
    for x in [-1.45,1.45]:box('cabin frame',(x,-1.3,1.1),(.12,.16,1.9),metal)
    for i in range(6):box('air-conditioning fin',(-1.63,-.5+i*.18,1.2),(.05,.08,.65),metal,.01)
    box('roof rack',(0,0,2.24),(2.4,1.8,.12),metal)
    text('FLIGHT CONTROL',(0,-1.4,.65),.18,black)

def dish():
    cyl('dish foundation',(0,0,.1),.6,.2,concrete)
    cyl('dish pedestal',(0,0,1.5),.13,2.8,metal)
    # Lathed shallow parabolic reflector, with real rim and support struts.
    vertices=[];faces=[]
    for j in range(9):
        r=.02+j/8
        for i in range(40):
            a=i*math.pi/20;vertices.append((r*math.cos(a),r*math.sin(a),3+.45*r*r))
    for j in range(8):
        for i in range(40):
            a=j*40+i;b=j*40+(i+1)%40;faces.append((a,b,b+40,a+40))
    m=bpy.data.meshes.new('parabolic reflector');m.from_pydata(vertices,[],faces);m.update()
    o=bpy.data.objects.new('parabolic reflector',m);bpy.context.collection.objects.link(o);finish(o,'parabolic reflector',shell)
    for i in range(4):
        a=i*math.pi/2;pipe('feed support',[(math.cos(a),math.sin(a),3.45),(0,0,4)],.025,metal)
    cyl('feed receiver',(0,0,4),.09,.22,metal)
    pipe('receiver cable',[(0,.15,.2),(0,.15,2.7),(.4,.15,3)],.025,black)

def workstation():
    # Blender -Y becomes glTF +Z. These contact heights match the resident rig.
    box('ceramic desktop',(0,-.2,.96),(1.6,1,.13),shell,.09)
    box('desktop edge',(0,-.2,.9),(1.56,.96,.035),metal,.02)
    for x in [-.63,.63]:
        for y in [-.52,.13]:
            cyl('desk leg',(x,y,.48),.045,.9,metal)
            cyl('leveling foot',(x,y,.035),.085,.07,black)
    box('underdesk controller',(.42,-.25,.79),(.36,.42,.16),metal,.025)
    for i in range(5):box('controller vent',(.42,-.47,.77+i*.012),(.25,.015,.005),black,.001)
    pipe('desk power lead',[(.48,-.25,.83),(.62,-.25,.5),(.63,-.52,.09)],.015,black)
    box('seat cushion',(0,.69,.5),(.73,.66,.12),black,.1)
    box('back cushion',(0,.98,.83),(.73,.1,.55),black,.09)
    for x in [-.27,.27]:
        for y in [.89,.45]:cyl('chair leg',(x,y,.24),.035,.5,metal)
        pipe('chair back frame',[(x,.89,.12),(x,1.01,.55),(x,1.01,1.07)],.025,metal)
    for x in [-.23,0,.23]:box('backrest stitch',(x,.923,.83),(.009,.007,.32),shell,.002)
    cyl('sample flask',(-.61,-.5,1.15),.09,.22,metal)
    cyl('flask cap',(-.61,-.5,1.27),.085,.025,orange)
    cyl('cup',(.56,-.11,1.095),.1,.19,shell)
    cyl('cup opening',(.56,-.11,1.194),.08,.012,black)

def telescope():
    cyl('telescope raft',(0,0,.25),.52,.5,concrete)
    cyl('tracking pedestal',(0,0,.88),.16,.8,metal)
    box('azimuth drive',(0,0,1.35),(.6,.5,.38),metal,.08)
    before=set(bpy.data.objects)
    cyl('optical tube',(0,0,0),.33,2.2,shell)
    for h in [-.8,.3,.95]:cyl('optical tube ring',(0,0,h),.37,.11,metal)
    cyl('aperture hood',(0,0,1.12),.41,.28,black)
    cyl('primary optic',(0,0,1.265),.33,.015,glass)
    cyl('rear detector',(0,0,-1.2),.21,.25,metal)
    box('finder camera',(.42,0,.5),(.18,.25,.65),metal,.035)
    pipe('detector harness',[(.2,.16,-1.2),(.38,.16,-.6),(.38,.16,0)],.025,black)
    pivot=bpy.data.objects.new('inclined optical assembly',None);bpy.context.collection.objects.link(pivot)
    for o in set(bpy.data.objects)-before:
        if o!=pivot:o.parent=pivot
    pivot.rotation_euler[1]=.50;pivot.location=(.2,0,2.15)
    box('tracking console',(-.63,-.04,.87),(.55,.38,.18),shell,.04)
    box('console display',(-.63,-.04,.967),(.42,.25,.015),glass,.01)

def satellite():
    box('thermal bus',(0,0,0),(1.4,1.7,1.6),shell,.16)
    for z in [-.65,.65]:box('bus reinforcing rail',(0,-.9,z),(1.3,.12,.1),metal,.02)
    for side in [-1,1]:
        cyl('array drive',(side*.9,0,0),.12,.6,metal,axis='X')
        box('array frame',(side*2.1,0,0),(2.1,1.9,.12),metal,.02)
        for x in [-.68,0,.68]:
            box('solar cell bank',(side*2.1+x,0,.08),(.62,1.75,.025),glass,.01)
            for y in [-.7,-.35,0,.35,.7]:box('cell conductor',(side*2.1+x,y,.1),(.6,.012,.008),shell,.001)
        cyl('attitude thruster',(side*.66,.8,-.6),.12,.25,metal,axis='Y')
    cyl('communications neck',(0,0,1),.09,.5,metal)
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.17,radius2=.55,depth=.25,location=(0,0,1.3));finish(bpy.context.object,'high gain antenna',shell)
    cyl('antenna receiver',(0,0,1.6),.035,.4,metal)
    box('star tracker',(0,-.94,.4),(.45,.22,.35),metal,.04)
    cyl('star tracker optic',(0,-1.07,.4),.13,.04,glass,axis='Y')
    pipe('instrument harness',[(.7,-.4,.7),(.7,.4,.7),(.5,.4,1)],.025,black)

def survey_console():
    cyl('console footing',(0,0,.1),.38,.2,concrete)
    cyl('console pedestal',(0,0,.65),.12,1.3,metal)
    box('instrument housing',(0,0,1.32),(2.4,1.1,.18),shell,.06)
    box('instrument gasket',(0,0,1.42),(2.2,.9,.045),black,.02)
    box('map display',(-.36,0,1.45),(1.25,.76,.025),glass,.015)
    for x in [-.82,-.38,.06]:box('map trace',(x,0,1.47),(.012,.64,.005),light,.001)
    for y in [-.22,0,.22]:box('map trace',(-.36,y,1.47),(1.12,.012,.005),metal,.001)
    for y in [-.25,0,.25]:
        cyl('rotary control',(.7,y,1.48),.07,.06,metal)
        box('control index',(.7,y,1.515),(.013,.055,.008),orange,.001)
    for x in [-1.08,1.08]:
        for y in [-.4,.4]:cyl('housing bolt',(x,y,1.45),.025,.025,metal,verts=8)
    box('power socket',(0,.57,1.28),(.3,.05,.09),black,.01)
    pipe('pedestal harness',[(.15,0,.18),(.15,0,1.1),(.7,0,1.18)],.022,black)

def sample_cabinet():
    box('cabinet foot',(0,0,.08),(1,1.4,.16),concrete,.04)
    box('insulated cabinet',(0,0,.63),(.98,1.38,1.1),shell,.06)
    for z in [.38,.77]:
        box('drawer seam',(0,-.71,z),(.86,.035,.32),black,.015)
        box('drawer face',(0,-.735,z),(.8,.025,.27),metal,.015)
        box('drawer handle',(0,-.78,z+.04),(.3,.06,.035),orange,.008)
        for x in [-.35,.35]:cyl('drawer latch',(x,-.77,z),.025,.025,metal,axis='Y',verts=8)
    box('sample tray',(0,0,1.21),(.88,1.2,.08),metal,.03)
    for x in [-.24,0,.24]:
        for y in [-.35,0,.35]:
            cyl('core sample vial',(x,y,1.31),.075,.16,shell,verts=16)
            cyl('sample cap',(x,y,1.4),.08,.03,orange,verts=16)
    for y in [-.4,-.2,0,.2,.4]:box('service vent',(.505,y,.65),(.015,.08,.25),black,.005)
    box('status readout',(0,.71,.85),(.45,.025,.23),glass,.02)


# ---- Phase 3: pressurized habitat kit -------------------------------------
# Tiles assemble into enclosures around the colony decks. Local convention for
# wall-type tiles: the interior face lies on y=0, the exterior extends toward -Y
# (glTF +Z), x runs along the wall, z is height with the floor at z=0. Dust
# skirts drop below the floor so decks of different heights meet the ground.
# Trim parts skip bevels: they are centimetres wide and the GLB budget is tight.
warm=plain('interior lamp',(1.0,.82,.6),0,.4,2.6)
liner=plain('interior liner',(.76,.73,.66),0,.8)
leaf=plain('hydroponic foliage',(.28,.52,.22),0,.75)
grow=plain('grow lamp',(.95,.45,.85),0,.3,2.5)
def trim(name,pos,size,mat):return box(name,pos,size,mat,0)
def stud(name,pos,r,depth,mat,axis='Z',verts=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=pos)
    o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    finish(o,name,mat,0)
    for f in o.data.polygons:f.use_smooth=True
    return o

def hab_wall():
    box('insulated wall panel',(0,-.13,1.6),(2,.22,3.2),shell,.03)
    trim('interior liner',(0,.02,1.65),(1.92,.04,3.0),liner)
    for x in [-.96,.96]:box('exterior rib',(x,-.3,1.6),(.08,.12,3.1),metal,.015)
    box('tie band',(0,-.3,1.05),(2,.1,.09),metal,.015)
    for x in [-.6,-.2,.2,.6]:stud('band fastener',(x,-.36,1.05),.022,.025,orange,axis='Y')
    box('dust skirt',(0,-.3,-.24),(2,.1,1.12),metal,.02)
    pipe('service conduit',[(-1,-.34,2.65),(1,-.34,2.65)],.035,black)
    trim('ceiling cove lamp',(0,.055,3.0),(1.9,.05,.045),warm)

def hab_glass():
    box('glazing sill',(0,-.13,.36),(2,.22,.72),shell,.03)
    trim('sill liner',(0,.02,.38),(1.92,.04,.68),liner)
    trim('pressure glazing',(0,-.1,1.86),(1.9,.03,2.3),glass)
    for x in [-.97,.97]:box('glazing mullion',(x,-.14,1.86),(.07,.2,2.34),metal,.012)
    box('glazing transom',(0,-.13,3.1),(2,.22,.2),shell,.02)
    box('sill rail',(0,-.3,.72),(2,.1,.09),metal,.015)
    for x in [-.6,.6]:stud('sill fastener',(x,-.36,.72),.022,.025,orange,axis='Y')
    box('dust skirt',(0,-.3,-.24),(2,.1,1.12),metal,.02)
    trim('ceiling cove lamp',(0,.055,3.0),(1.9,.05,.045),warm)

def hab_corner():
    box('corner column',(0,0,1.6),(.4,.4,3.3),shell,.05)
    for pos,size in [((0,-.22,1.6),(.1,.06,3.2)),((0,.22,1.6),(.1,.06,3.2)),((-.22,0,1.6),(.06,.1,3.2)),((.22,0,1.6),(.06,.1,3.2))]:
        box('corner rib',pos,size,metal,.012)
    box('corner cap',(0,0,3.3),(.46,.46,.12),metal,.02)
    box('corner base',(0,0,-.28),(.46,.46,1.04),metal,.02)

def hab_airlock(width=2,opening=1.3,depth=.6):
    pillar=(width-opening)/2
    for s in [-1,1]:
        x=s*(opening/2+pillar/2)
        box('airlock pillar',(x,-depth/2,1.6),(pillar,depth,3.2),shell,.04)
        box('airlock plinth',(x,-depth/2,-.4),(pillar,depth,.8),metal,.02)
        trim('door pocket seal',(s*(opening/2+.03),-depth/2,1.15),(.06,depth-.08,2.3),black)
        for h in [.35,.75,1.15,1.55]:trim('safety marking',(x,-depth-.01,h),(pillar*.7,.02,.1),orange)
    box('airlock header',(0,-depth/2,2.75),(width,depth,.9),shell,.04)
    trim('header seal',(0,-depth/2,2.33),(opening+.12,depth-.08,.06),black)
    trim('door light bar',(0,-depth-.02,2.45),(opening*.7,.03,.07),light)
    box('airlock hood',(0,-depth-.42,3.05),(width+.2,.9,.14),shell,.03)
    for x in [-width/2+.25,width/2-.25]:pipe('hood strut',[(x,-depth-.02,2.6),(x,-depth-.8,2.98)],.03,metal)
    trim('access keypad',(opening/2+pillar/2,-depth-.03,1.35),(pillar*.5,.04,.22),black)
    trim('keypad readout',(opening/2+pillar/2,-depth-.055,1.4),(pillar*.3,.01,.05),light)
    trim('ceiling cove lamp',(0,.055,3.0),(width-.1,.05,.045),warm)

def hab_gate():hab_airlock(3.2,2.4,.5)
# Shallow variant for doors that open onto the shared concourse lane.
def hab_airlock_flush():hab_airlock(2,1.3,.25)

def hab_roof():
    box('roof panel',(0,0,.08),(2,2,.16),shell,.03)
    for y in [-.96,.96]:trim('roof seam rail',(0,y,.18),(2,.08,.06),metal)
    for x in [-.96,.96]:trim('roof seam rail',(x,0,.18),(.08,2,.06),metal)
    for x in [-.8,.8]:
        for y in [-.8,.8]:stud('roof fastener',(x,y,.2),.03,.03,metal)
    trim('ceiling liner',(0,0,-.02),(1.96,1.96,.04),liner)
    trim('ceiling luminaire',(0,0,-.07),(1.1,.34,.06),warm)

def hab_radiator():
    box('radiator frame',(0,-.08,.5),(1.4,.16,1.0),metal,.02)
    for i in range(9):trim('radiator fin',(-.6+i*.15,-.19,.5),(.04,.14,.86),shell)
    pipe('coolant loop',[(-.62,-.1,-.02),(-.62,-.1,1.0),(.62,-.1,1.0),(.62,-.1,-.02)],.03,metal)
    for x in [-.55,.55]:trim('radiator bracket',(x,.03,.5),(.12,.06,.9),metal)

def hab_locker():
    box('locker bank',(0,0,1.0),(1.2,.5,2.0),shell,.03)
    trim('locker plinth',(0,0,.05),(1.24,.54,.1),metal)
    for i in range(3):
        x=-.4+i*.4
        trim('locker door seam',(x,-.255,1.0),(.36,.02,1.9),black)
        trim('locker door',(x,-.265,1.0),(.33,.015,1.84),metal)
        trim('locker handle',(x+.1,-.29,1.1),(.03,.03,.16),orange)
        for k in range(4):trim('locker vent',(x,-.28,1.75+k*.04),(.2,.01,.012),black)

def hab_crate():
    box('cargo crate',(0,0,.36),(.8,.8,.7),shell,.04)
    for x in [-.25,.25]:trim('crate strap',(x,0,.36),(.06,.84,.74),orange)
    for y in [-.41,.41]:
        trim('crate rail',(0,y,.05),(.82,.04,.1),metal)
        trim('crate rail',(0,y,.67),(.82,.04,.08),metal)
    trim('cargo label',(0,-.41,.3),(.3,.01,.14),black)

def hab_planter():
    for x in [-.72,.72]:
        for y in [-.25,.25]:stud('planter post',(x,y,.9),.025,1.8,metal)
    for z in [.3,.85,1.4]:
        trim('hydroponic tray',(0,0,z),(1.6,.6,.08),metal)
        trim('nutrient bed',(0,0,z+.05),(1.5,.5,.03),black)
        for i in range(4):
            for j in range(2):
                bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=.11,location=(-.54+i*.36,-.12+j*.24,z+.12))
                o=bpy.context.object;o.scale=(1.25,1,.7);finish(o,'foliage',leaf)
        trim('grow lamp',(0,0,z+.5),(1.5,.08,.03),grow)

def hab_rack():
    box('rack frame',(0,0,1.0),(.6,.8,2.0),black,.02)
    trim('rack shell',(0,.02,1.0),(.56,.78,1.96),metal)
    for k in range(9):
        z=.25+k*.19
        trim('server blade',(0,-.4,z),(.5,.03,.15),shell)
        trim('blade status',(.17,-.42,z),(.06,.01,.02),light)
        trim('blade handle',(-.2,-.42,z),(.05,.012,.06),orange)
    trim('rack vent',(0,.4,1.0),(.5,.02,1.6),black)

def hab_galley():
    box('galley counter',(0,0,.5),(1.6,.7,1.0),shell,.03)
    trim('counter top',(0,0,1.02),(1.66,.76,.05),metal)
    for x in [-.5,.5]:
        trim('counter drawer',(x,-.36,.7),(.6,.02,.3),metal)
        trim('drawer pull',(x,-.38,.75),(.2,.02,.03),orange)
    box('dispenser',(.35,-.1,1.35),(.4,.45,.6),metal,.02)
    trim('dispenser spout',(.35,-.4,1.2),(.06,.2,.04),black)
    trim('dispenser screen',(.35,-.33,1.5),(.25,.01,.15),light)
    for i in range(3):stud('ration cup',(-.5+i*.2,-.1,1.12),.05,.14,shell,verts=12)
    box('overhead cabinet',(0,.2,2.0),(1.6,.4,.6),shell,.02)
    for x in [-.4,.4]:trim('cabinet door seam',(x,-.005,2.0),(.76,.01,.56),black)

module('pressure-habitat',pressure)
module('solar-rack',solar)
module('sensor-mast',sensor)
module('service-wall',service_wall)
module('resource-tank',resource_tank)
module('survey-rover',rover)
module('survey-rocket',rocket)
module('launch-gantry',gantry)
module('control-cabin',cabin)
module('communications-dish',dish)
module('workstation',workstation)
module('telescope',telescope)
module('orbital-relay',satellite)
module('survey-console',survey_console)
module('sample-cabinet',sample_cabinet)
module('hab-wall',hab_wall)
module('hab-glass',hab_glass)
module('hab-corner',hab_corner)
module('hab-airlock',hab_airlock)
module('hab-gate',hab_gate)
module('hab-airlock-flush',hab_airlock_flush)
module('hab-roof',hab_roof)
module('hab-radiator',hab_radiator)
module('hab-locker',hab_locker)
module('hab-crate',hab_crate)
module('hab-planter',hab_planter)
module('hab-rack',hab_rack)
module('hab-galley',hab_galley)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/world-kit.blend'))
# Preserve nested authored transforms while optimizing each module by material.
for root in roots:
    children=list(root.children_recursive)
    for o in children:
        if o.type in {'MESH','CURVE','FONT'}:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            bpy.ops.object.convert(target='MESH')
    for mat in list(bpy.data.materials):
        members=[o for o in root.children_recursive if o.type=='MESH' and mat in o.data.materials[:]]
        if not members:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in members:o.select_set(True)
        bpy.context.view_layer.objects.active=members[0]
        bpy.ops.object.join();o=bpy.context.object
        matrix=o.matrix_world.copy();o.parent=root;o.matrix_world=matrix;o.name=root.name+' / '+mat.name
kitout=ROOT/'public/models/world-kit';kitout.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(kitout/'colony-hardware.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
(kitout/'manifest.json').write_text(json.dumps({'source':'assets/blender/world-kit.blend','generator':'assets/blender/build_world_kit.py','modules':[r.name for r in roots],'units':'metres','front':'+Z in glTF'},indent=2)+'\n')
