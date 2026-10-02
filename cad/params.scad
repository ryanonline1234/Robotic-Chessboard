// Shared dimensions for the gantry, its printed parts and the assembly.
//
// Units are millimetres. Machine coordinates: the origin is the front-left
// corner of the base's top surface, X runs to the right along the board's
// 10-cell direction, Y runs away from you along the 8 ranks, Z is up.
// Parts that ride on the X gantry are drawn in "gantry Y": 0 is the line
// through the magnet, so they sit at gantry_y + y in machine coordinates.
//
// Included by gantry-parts.scad and assembly.scad. Change a number here and
// both follow. Values marked "estimate" were not checked against a real
// part; measure yours before printing.

// ---------- Board grid (matches cad/make-board.js and src/gcode.js) ----------
square = 40;
storage_cols = 1;
grid_cols = 8 + 2 * storage_cols; // 10 cells across, storage included
grid_rows = 8;
sheet_w = grid_cols * square;     // 400: printed surface, X
sheet_d = grid_rows * square;     // 320: printed surface, Y
reach_x = sheet_w - square;       // 360: between the outermost cell centres
reach_y = sheet_d - square;       // 280
min_margin = 5;                   // travel required beyond the outermost centres

// ---------- Base, frame and top ----------
base_w = 600;
base_d = 500;
base_t = 12;      // plywood or MDF
wall_t = 12;      // frame walls, screwed to the outside edges of the base
top_t = 3;        // hardboard top
sag_allow = 3;    // how far the middle of the top may sit below its edges

// ---------- Fasteners and printing ----------
m3_clear = 3.4;   // M3 clearance hole
m3_tap = 2.9;     // pilot hole an M3 screw cuts its own thread into
m3_head_d = 5.5;  // M3 socket head
m3_head_h = 3;
m3_nut_af = 5.5;  // across flats
m3_nut_h = 2.4;
wood_clear = 4.2; // 3.5-4 mm wood screw
wood_head_d = 8.4;
fit = 0.5;        // general clearance between printed parts and bought parts

// ---------- Smooth rods and LM8UU bearings ----------
rod_d = 8;
rod_len = 500;    // all four rods, uncut
rod_hole = 8.2;   // rod clearance (holders and sockets, locked by set screws)
grub_in = 8;      // X rod grub screws: one this far from the rod end ...
grub_out = 4;     // ... and one this far from the socket mouth
lm_d = 15;
lm_len = 24;
lm_bore = 15.2;   // press fit for the LM8UU
lm_stop_d = 9.5;  // shoulder between two bearings pressed in from each end;
                  // leaves 1 mm of plastic over the Y belt clamp pilot holes
lm_wall_below = 3.9; // plastic under a bearing bore (room for clamp screws)

// ---------- NEMA 17 stepper ----------
nema_w = 42.3;
nema_len = 48;    // longest common body; 40 mm motors fit with more room
nema_pitch = 31;  // M3 hole square
nema_boss_d = 22;
nema_boss_h = 2;
nema_boss_hole = 22.6;
nema_shaft_d = 5;
nema_shaft_len = 24;

// ---------- GT2 belt, 20T pulley, 20T idler ----------
belt_w = 6;
belt_back = 0.63;      // belt backing outside the pulley's tooth tips
belt_tooth = 0.75;     // tooth height
pulley_tip_d = 12.22;  // 20T tooth-tip diameter (pitch diameter 12.73)
pulley_flange_d = 16;
pulley_len = 16;
pulley_hub_len = 7;    // estimate
pulley_teeth_len = 9;  // toothed part, flanges included, estimate
pulley_off = 4.5;      // pulley end (flange) to the belt line, along the shaft
idler_d = 18;          // flange diameter of a 20T toothed idler, 3 mm bore
idler_w = 8.5;
idler_slot = idler_w + 1.5; // room for the idler plus an M3 washer

// ---------- Electromagnet (P20/15) and its spring ----------
mag_d = 20;
mag_h = 15;
mag_thread_engage = 5; // how far the M3 guide screw goes into the magnet (measure yours)
sleeve_id = mag_d + 0.6;
sleeve_wall = 2;
floor_t = 4;           // carriage floor under the magnet
spring_pocket_d = 7.5; // seats a spring up to 7 mm across
spring_pocket_h = 2;
spring_free = 20;      // free length of the spring this is drawn for (estimate)
spring_od = 6;
guide_screw_len = 25;  // M3 x 25: guide pin and up-stop for the magnet

// ---------- Mechanical endstop module (RepRap style PCB) ----------
// Drawn as the "Mechanical Endstop v1.1" datasheet board: 40 x 16 mm, the
// switch at one end, the 3-pin connector at the other, two holes along one
// long edge. One shop lists the v1.2 board as 36.5 x 16 x 10 mm overall, and
// clones differ, so measure yours. Both switches stand on end with the
// connector at the bottom, below the part that presses the lever, so the plug
// stays clear whatever its height. Heights are off the PCB's component side.
es_pcb = [40, 16, 1.6];  // long side, short side, thickness
es_hole_inset = 2.5;
es_hole_span = 35;
es_body = 6.5;     // switch body height, estimate
es_trigger = 8;    // lever height where the switch trips, estimate
es_lever = 10;     // free lever height, estimate
es_conn = [6, 10, 18]; // connector with its plug: along the board, across it, height (generous estimate)
es_relief = 2.5;   // pocket behind the PCB for its solder pins

// ---------- Heights (Z) ----------
z_shaft = 24.25;                                  // every pulley and idler axis
belt_top = z_shaft + pulley_tip_d / 2 + belt_back; // 31.0: back of the upper belt run
z_flat = belt_top;                                // flat underside of carriage and end blocks
z_rod = z_flat + lm_wall_below + lm_bore / 2;     // 42.5: all four rods
z_parts_top = z_rod + 11.5;                       // 54: top of carriage and end blocks
z_board = 61;                                     // underside of the 3 mm top
sleeve_top = z_board - 5;                         // rim of the magnet sleeve

// ---------- Layout (X and Y) ----------
xL = 30;                       // left Y rod
xR = base_w - xL;              // right Y rod
rod_x0 = (base_w - rod_len) / 2; // X rods run from 50 ...
rod_x1 = rod_x0 + rod_len;       // ... to 550
x_rod_dy = 25;                 // X rods at gantry y = -25 and +25
house_hw = 11.5;               // half width of a bearing housing
eb_half = 41;                  // end block half length along Y
eb_lm_c = 27.5;                // Y bearing centres at gantry y = +-27.5
x_pulley = 66;                 // X motor pulley axis: its motor clears the Y idler
x_idler = base_w - x_pulley;   // X idler axis
eb_face_L = x_pulley + 9.5;    // inner face of the motor end block (pulley tucked under it)
eb_face_R = base_w - eb_face_L;
eb_rear_L = 37.5;              // rear face of the motor end block, gantry y
xbelt_y = 25;                  // X belt line, gantry y (under the rear X rod)
mm_plate_t = 6;                // X motor mount plate
ybelt_x = xL + 4.5;            // Y belt line, under the left bearing housing
ymotor_y = 28;                 // Y motor shaft, machine Y
yidler_y = 464;                // Y idler axle, machine Y, with the mount at its front stop
yidler_slide = 6;              // the Y idler mount slides back this far to tension the belt
ym_plate_t = 5;                // Y motor mount plate
mm_x0 = xL + house_hw + 0.5;   // X motor mount plate, left edge (clears the bearing housing)
mm_x1 = x_pulley + 23;         // ... right edge
yim_x0 = 7;                    // Y idler mount base, outboard edge ...
yim_x1 = mm_x0 - 1;            // ... inboard edge: 1 mm short of the X motor mount passing over it
yim_slot_x = 14;               // its wood-screw slots, outboard of the Y rod
mm_screw_x = [48, 64];         // two M3 screws hold the X motor mount to the end block
mm_screw_z = 50;               // above the motor body
mm_lip = [2, 5];               // lip on the X motor mount over the end block: thickness, reach
es_x_plate = 4;                // X endstop bracket behind the PCB
es_x_z0 = z_parts_top - es_pcb[0]; // 14: lower (connector) end of the X endstop PCB
es_x_y0 = -es_pcb[1] / 2;      // X endstop PCB from gantry y = -8 to 8
xe_br_y = [-18, 9];            // X endstop bracket, gantry y
xe_br_back = 7.5;              // ... block that reaches back under the end block
xe_br_screw = [-13, 47];       // ... (y, z) of its own screw into the end block

// ---------- Carriage ----------
car_l = 2 * lm_len + 2;                 // 50 along X: two LM8UU per rod
car_hw = x_rod_dy + house_hw - 1;       // 35.5 half width along Y
clamp_dx = 16;                          // X belt clamps at +-16 from the magnet axis

// ---------- Rod holders ----------
holder_w = 18;     // across the rod (X)
holder_d = 18;     // along the rod (Y): rod engagement
holder_h = z_rod + rod_d / 2 + 4.5;
holder_flange = 14;
flange_t = 5;

// ---------- Belt clamp plate (one design, used four times) ----------
clamp_len = 16;    // along the belt
clamp_wid = 22;    // across the belt
clamp_t = 4;
clamp_screw = 7;   // screws at +-7 across the belt
clamp_pilot = 5;   // pilot depth in the part: an M3 x 10 goes in 4.6 mm

// ---------- Travel of the magnet axis, machine coordinates ----------
// Hard limits are where two parts would be 1 mm apart; homing switches sit
// at the X-max / Y-max corner because GRBL homes toward + by default ($23=0).
// After homing, machine zero is where each switch trips, and GRBL's soft
// limits let the magnet go back from there by $130 (X) and $131 (Y).
grbl_x = 380;                                               // $130, DESIGN.md
grbl_y = 300;                                               // $131, DESIGN.md
pulloff = 1;                                                // GRBL $27
x_hard_min = eb_face_L + 1 + car_l / 2;                     // carriage vs motor end block
x_home = eb_face_R - es_x_plate - es_pcb[2] - es_trigger - car_l / 2; // X switch trips
y_hard_min = ymotor_y + 24 + 1 + eb_half;                   // end block vs Y motor mount
y_hard_max = base_d - 2 - (eb_rear_L + mm_plate_t + nema_len); // X motor vs back wall
y_home = y_hard_max - 3.5;                                  // Y switch trips
ye_pcb_front = y_home + eb_half + es_trigger;               // Y endstop PCB, switch side
ye_pcb_x = 547;                                             // ... left edge (clear of the idler foot)
ye_pcb_z = z_parts_top - es_pcb[0];                         // ... lower (connector) end, 14
ye_foot_x0 = 524;                                           // Y endstop post's foot, left edge
