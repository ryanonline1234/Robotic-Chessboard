// The whole machine: base, rods, gantry, carriage, magnet, motors, belts,
// frame and the 3 mm top, with checks that it fits together (OpenSCAD).
//
// Bought parts (motors, bearings, pulleys, magnet, switches) are simple
// stand-ins drawn to their catalogue sizes. Printed parts come from
// gantry-parts.scad. Coordinates are explained in params.scad.
//
//   openscad assembly.scad                      magnet under cell (0, 0)
//   openscad -D cell_x=9 -D cell_y=7 assembly.scad
//   openscad -D 'view="section"' assembly.scad  cut through the magnet
//   openscad -D 'view="top"' -D labels=true assembly.scad
//   openscad -D 'check="collide"' -o out.stl assembly.scad
//       renders only the overlaps between moving and fixed parts at the
//       four corners of travel; OpenSCAD reports an empty object if none.
// cad/export.sh has the camera settings used for the pictures in docs/img.
//
// The echo() lines at the end print the reach, clearance and travel checks.
// Cables are not modelled, so nothing here checks them.

include <params.scad>
use <gantry-parts.scad>

cell_x = 0;            // 0..9 from the left storage column
cell_y = 0;            // 0..7 from rank 1
view = "assembly";     // "assembly", "top" or "section"
show_top = true;       // the 3 mm top and its printed sheet
top_alpha = 0.22;      // see-through so the gantry shows
sheet_alpha = 0.9;     // the printed board sheet
walls = "back";        // "all", "back" (front and side walls left off) or "none"
labels = false;        // text labels for the section and top views
show_base = true;      // false to look at the gantry from below
check = "none";        // "collide": render only interferences
check_push = 0;        // mm to push the gantry past its front stop (test the test)
$fn = 32;

// ---------- Where the board sits ----------
// Where GRBL's soft limits let the magnet go after homing (machine zero is
// where the switch trips; see params.scad), then the printed sheet centred
// on that window.
soft_x0 = x_home - grbl_x;
soft_x1 = x_home;
soft_y0 = y_home - grbl_y;
soft_y1 = y_home;
sheet_x0 = (soft_x0 + soft_x1) / 2 - sheet_w / 2;
sheet_y0 = (soft_y0 + soft_y1) / 2 - sheet_d / 2;

function cell_cx(i) = sheet_x0 + (i + 0.5) * square;
function cell_cy(j) = sheet_y0 + (j + 0.5) * square;

mx = cell_cx(cell_x);  // magnet axis X = carriage X
my = cell_cy(cell_y);  // magnet axis Y = gantry Y

clamp_bottom = belt_top - belt_back - belt_tooth - clamp_t;  // underside of every belt clamp

// ---------- Colours ----------
c_print = "#e8743b";   // printed parts
c_print2 = "#f2a541";  // small printed parts
c_steel = "#b8bec6";
c_dark = "#3b3f45";
c_belt = "#1f1f1f";
c_wood = "#d8b98a";
c_top = "#c9a877";
c_pcb = "#2f6db5";

// ---------- Section cut ----------
// In the section view everything is cut on the plane x = mx (through the
// magnet) and only a 70 mm slab behind it is kept, seen from +X. OpenSCAD's
// preview paints every cut face one colour, so the true section is drawn
// on top as thin coloured 2D slices (projection with cut = true).
// c = undef keeps the children's own colours (outside the section view).
module part_color(c, a = 1) {
  if (view == "section") {
    cc = c == undef ? c_pcb : c;
    color(cc, a) intersection() {
      children();
      translate([mx - 70, -2000, -2000]) cube([70, 4000, 4000]);
    }
    color(cc, a) translate([mx + 0.3, 0, 0]) rotate([0, -90, 0]) linear_extrude(0.3)
      projection(cut = true) rotate([0, 90, 0]) translate([-mx, 0, 0]) children();
  } else if (c == undef) children();
  else color(c, a) children();
}

// ---------- Stand-ins for bought parts ----------

// NEMA 17: mounting face at z = 0, body toward -Z, shaft toward +Z.
module nema17() {
  color(c_dark) translate([0, 0, -nema_len])
    linear_extrude(nema_len) offset(r = 3) square(nema_w - 6, center = true);
  color(c_steel) translate([-nema_w / 2 + 0.5, -nema_w / 2 + 0.5, -8]) cube([nema_w - 1, nema_w - 1, 8]);
  color(c_steel) cylinder(d = nema_boss_d, h = nema_boss_h);
  color(c_steel) cylinder(d = nema_shaft_d, h = nema_shaft_len);
}

// GT2 20T pulley: toothed part from z = 0 to 9 between flanges, hub after it.
module pulley() {
  color(c_steel) {
    cylinder(d = pulley_flange_d, h = 1);
    cylinder(d = pulley_tip_d, h = pulley_teeth_len);
    translate([0, 0, pulley_teeth_len - 1]) cylinder(d = pulley_flange_d, h = 1);
    translate([0, 0, pulley_teeth_len]) cylinder(d = 13, h = pulley_hub_len);
  }
}

// GT2 20T toothed idler, centred on its axis.
module idler() {
  color(c_steel) translate([0, 0, -idler_w / 2]) {
    cylinder(d = idler_d, h = 1);
    cylinder(d = pulley_tip_d, h = idler_w);
    translate([0, 0, idler_w - 1]) cylinder(d = idler_d, h = 1);
  }
}

// LM8UU linear bearing centred on its axis (along Z).
module lm8uu() {
  color(c_steel) difference() {
    cylinder(d = lm_d, h = lm_len, center = true);
    cylinder(d = rod_d + 0.2, h = lm_len + 1, center = true);
    for (s = [-1, 1]) translate([0, 0, s * 8]) difference() {
      cylinder(d = lm_d + 1, h = 1.1, center = true);
      cylinder(d = lm_d - 0.6, h = 2, center = true);
    }
  }
}

// P20/15 holding magnet: face (pole side) up at z = 0.
module magnet() {
  color("#8b9097") translate([0, 0, -mag_h]) cylinder(d = mag_d, h = mag_h);
  color("#e8e8e8") translate([0, 0, -0.1]) cylinder(d = mag_d - 0.5, h = 0.1);  // PTFE tape
  color("#c0392b") for (s = [-1, 1]) translate([s * 5, 0, -mag_h - 4]) cylinder(d = 1.2, h = 4);
}

// Compression spring between z = 0 and z = len.
module spring(len) {
  n = 7;
  color("#d4d8dc") for (i = [0 : n]) translate([0, 0, 0.4 + i * (len - 0.8) / n])
    rotate_extrude($fn = 24) translate([(spring_od - 0.5) / 2, 0]) circle(d = 0.5, $fn = 8);
}

// M3 screw with its head at z = 0 (head below), shank up to z = len + 3.
module m3_screw(len) {
  color(c_dark) {
    translate([0, 0, -m3_head_h]) cylinder(d = m3_head_d, h = m3_head_h);
    cylinder(d = 3, h = len);
  }
}

// Endstop module stand-in, built facing +Z with the PCB's back at z = 0 and
// its long side along X: the switch near the far end, the connector (with a
// plug in it) at the near end. These boxes are also used for the checks.
es_lb_body = [[es_pcb[0] - 18, 3, es_pcb[2]], [es_pcb[0] - 5, 9, es_pcb[2] + es_body]];
es_lb_conn = [[1, (es_pcb[1] - es_conn[1]) / 2, es_pcb[2]], [1 + es_conn[0], (es_pcb[1] + es_conn[1]) / 2, es_pcb[2] + es_conn[2]]];
module box(b) { translate(b[0]) cube(b[1] - b[0]); }
module endstop_module() {
  color(c_pcb) cube(es_pcb);
  color(c_dark) box(es_lb_body);
  color(c_steel) translate([es_pcb[0] - 20, 3, es_pcb[2] + es_lever]) cube([16, 6, 0.4]);
  color("#ece6d6") box(es_lb_conn);
}

// A straight belt run of length len along +X, back of the belt at z = 0,
// teeth toward -Z, centred on y = 0.
module belt_run(len) {
  color(c_belt) translate([0, -belt_w / 2, -belt_back - belt_tooth]) cube([len, belt_w, belt_back + belt_tooth]);
}

// Belt wrapped half way round a 20T pulley or idler (axis along Z), on the
// side facing direction `dir` (angle in degrees in the XY plane).
module belt_wrap(dir) {
  r0 = pulley_tip_d / 2 - belt_tooth;
  r1 = pulley_tip_d / 2 + belt_back;
  color(c_belt) rotate([0, 0, dir]) intersection() {
    difference() {
      cylinder(r = r1, h = belt_w, center = true, $fn = 40);
      cylinder(r = r0, h = belt_w + 1, center = true, $fn = 40);
    }
    translate([0, -r1 - 1, -belt_w]) cube([r1 + 1, 2 * r1 + 2, 2 * belt_w]);
  }
}

// Endstop PCBs stand on end: long side up, connector at the bottom.
// X switch: on its bracket on the idler end block, facing the carriage (-X).
xe_matrix = [[0, 0, -1, eb_face_R - es_x_plate], [0, 1, 0, es_x_y0], [1, 0, 0, es_x_z0], [0, 0, 0, 1]];
// Y switch: on its post at the back right, facing the end block (-Y).
ye_matrix = [[0, -1, 0, ye_pcb_x + es_pcb[1]], [0, 0, -1, ye_pcb_front + es_pcb[2]], [1, 0, 0, ye_pcb_z], [0, 0, 0, 1]];
// A local box from endstop_module() placed by one of these matrices.
function xf(m, p) = [for (r = [0 : 2]) m[r][0] * p[0] + m[r][1] * p[1] + m[r][2] * p[2] + m[r][3]];
function es_box(m, b) = let(c = [for (i = [0, 1], j = [0, 1], k = [0, 1]) xf(m, [b[i][0], b[j][1], b[k][2]])])
  [[for (a = [0 : 2]) min([for (q = c) q[a]])], [for (a = [0 : 2]) max([for (q = c) q[a]])]];

// ---------- Fixed parts ----------

module holders() {
  part_color(c_print) {
    translate([xL, 0, 0]) y_rod_holder();
    translate([xL, base_d, 0]) mirror([0, 1, 0]) y_rod_holder();
    translate([xR, holder_d, 0]) rotate([0, 0, 180]) y_rod_holder();
    translate([xR, base_d, 0]) rotate([0, 0, 180]) y_rod_holder();
  }
}

module y_drive_fixed() {
  part_color(c_print) y_motor_mount();
  part_color(c_print) y_idler_mount();
  part_color(c_dark) translate([ybelt_x + 5.5 + ym_plate_t, ymotor_y, z_shaft]) rotate([0, -90, 0]) nema17();
  part_color(c_steel) translate([ybelt_x + pulley_off, ymotor_y, z_shaft]) rotate([0, -90, 0]) pulley();
  part_color(c_steel) translate([ybelt_x, yidler_y, z_shaft]) rotate([0, 90, 0]) idler();
}

module y_endstop_fixed() {
  part_color(c_print2) y_endstop_mount();
  part_color(undef) multmatrix(ye_matrix) endstop_module();
}

module rods_fixed() {
  part_color(c_steel) for (x = [xL, xR]) translate([x, 0, z_rod]) rotate([-90, 0, 0]) cylinder(d = rod_d, h = rod_len);
}

module base_and_frame() {
  if (show_base) part_color(c_wood) translate([0, 0, -base_t]) cube([base_w, base_d, base_t]);
  wall_h = base_t + z_board;
  part_color(c_wood) {
    if (walls == "all" || walls == "back") {
      translate([-wall_t, base_d, -base_t]) cube([base_w + 2 * wall_t, wall_t, wall_h]);
      translate([base_w, 0, -base_t]) cube([wall_t, base_d, wall_h]);
    }
    if (walls == "all") {
      translate([-wall_t, -wall_t, -base_t]) cube([base_w + 2 * wall_t, wall_t, wall_h]);
      translate([-wall_t, 0, -base_t]) cube([wall_t, base_d, wall_h]);
    }
  }
}

// Drawn last: OpenSCAD only shows see-through colours over what is already drawn.
module top_and_sheet() {
  if (show_top) {
    part_color(c_top, top_alpha) translate([-wall_t, -wall_t, z_board]) cube([base_w + 2 * wall_t, base_d + 2 * wall_t, top_t]);
    if (view != "section") board_sheet();
  }
}

// The printed board sheet (as cad/board-sheet.svg) on top of the top.
module board_sheet() {
  z = z_board + top_t;
  for (i = [0 : grid_cols - 1], j = [0 : grid_rows - 1]) {
    file = i - storage_cols;
    c = (file < 0 || file > 7) ? "#e3e6eb" : ((file + j) % 2 == 0 ? "#b38c65" : "#eadfc9");
    part_color(c, sheet_alpha) translate([cell_cx(i) - square / 2, cell_cy(j) - square / 2, z]) cube([square, square, 0.3]);
  }
}

// ---------- Moving parts ----------

module carriage_group() {
  part_color(c_print) translate([mx, 0, 0]) carriage();
  for (s = [-1, 1], t = [-1, 1]) part_color(c_steel) translate([mx + t * (car_l / 2 - lm_len / 2), s * x_rod_dy, z_rod]) rotate([0, 90, 0]) lm8uu();
  seat = z_flat + floor_t - spring_pocket_h;
  part_color("#8b9097") translate([mx, 0, z_board]) magnet();
  part_color("#d4d8dc") translate([mx, 0, seat]) spring(z_board - mag_h - seat);
  part_color(c_dark) translate([mx, 0, z_board - mag_h + mag_thread_engage - guide_screw_len]) m3_screw(guide_screw_len);
  for (t = [-1, 1]) part_color(c_print2) translate([mx + t * clamp_dx, xbelt_y, clamp_bottom]) belt_clamp();
}

module gantry_group() {
  translate([0, my, 0]) {
    part_color(c_print) end_block_motor();
    part_color(c_print) end_block_idler();
    part_color(c_print2) x_motor_mount();
    part_color(c_print2) x_endstop_mount();
    for (s = [-1, 1]) part_color(c_print2) translate([ybelt_x, s * clamp_len / 2, clamp_bottom]) rotate([0, 0, 90]) belt_clamp();
    part_color(c_dark) translate([x_pulley, eb_rear_L + mm_plate_t, z_shaft]) rotate([90, 0, 0]) nema17();
    part_color(c_steel) translate([x_pulley, xbelt_y - pulley_off, z_shaft]) rotate([-90, 0, 0]) pulley();
    part_color(c_steel) translate([x_idler, xbelt_y, z_shaft]) rotate([90, 0, 0]) idler();
    for (x = [xL, xR], s = [-1, 1]) part_color(c_steel) translate([x, s * eb_lm_c, z_rod]) rotate([90, 0, 0]) lm8uu();
    part_color(c_steel) for (s = [-1, 1]) translate([rod_x0, s * x_rod_dy, z_rod]) rotate([0, 90, 0]) cylinder(d = rod_d, h = rod_len);
    part_color(undef) multmatrix(xe_matrix) endstop_module();
    x_belt();
    carriage_group();
  }
}


// X belt, drawn in gantry coordinates.
module x_belt() {
  z_up = belt_top;
  z_lo = z_shaft - pulley_tip_d / 2 - belt_back;
  left_end = mx - clamp_dx + clamp_len / 2;
  right_end = mx + clamp_dx - clamp_len / 2;
  part_color(c_belt) translate([0, xbelt_y, 0]) {
    translate([x_pulley, 0, z_up]) belt_run(left_end - x_pulley);
    translate([right_end, 0, z_up]) belt_run(x_idler - right_end);
    translate([x_pulley, 0, z_lo]) mirror([0, 0, 1]) belt_run(x_idler - x_pulley);
    translate([x_pulley, 0, z_shaft]) rotate([90, 0, 0]) belt_wrap(180);
    translate([x_idler, 0, z_shaft]) rotate([90, 0, 0]) belt_wrap(0);
  }
}

// Y belt, machine coordinates; its ends are clamped under the motor end block.
module y_belt() {
  z_up = belt_top;
  z_lo = z_shaft - pulley_tip_d / 2 - belt_back;
  part_color(c_belt) translate([ybelt_x, 0, 0]) rotate([0, 0, 90]) {
    translate([ymotor_y, 0, z_up]) belt_run(my - 1 - ymotor_y);
    translate([my + 1, 0, z_up]) belt_run(yidler_y - my - 1);
    translate([ymotor_y, 0, z_lo]) mirror([0, 0, 1]) belt_run(yidler_y - ymotor_y);
    translate([ymotor_y, 0, z_shaft]) rotate([90, 0, 0]) belt_wrap(180);
    translate([yidler_y, 0, z_shaft]) rotate([90, 0, 0]) belt_wrap(0);
  }
}

module fixed_parts() {
  holders();
  rods_fixed();
  y_drive_fixed();
  y_endstop_fixed();
}

module machine() {
  base_and_frame();
  fixed_parts();
  y_belt();
  gantry_group();
  top_and_sheet();
}

// ---------- Section labels ----------
module label(t, y, z, size = 3.4, align = "left") {
  color("#222") translate([mx + 30, y, z]) rotate([90, 0, 90]) linear_extrude(0.4)
    text(t, size = size, font = "Liberation Sans", halign = align, valign = "center");
}

module lead_line(y0, z0, y1, z1) {
  color("#222") hull() {
    translate([mx + 30, y0, z0]) cube([0.4, 0.5, 0.5], center = true);
    translate([mx + 30, y1, z1]) cube([0.4, 0.5, 0.5], center = true);
  }
}

module section_labels() {
  yl = my + 62;
  // [text, label z, feature y, feature z]
  lead = [
    ["3 mm top, board sheet glued on", 67, my + 30, z_board + 1.5],
    ["magnet face (PTFE tape) on the top", 60.5, my + 6, z_board - 0.3],
    ["P20/15 magnet, slides in the sleeve", 54, my + 7, z_board - 9],
    ["light spring pushes it up", 47.5, my + 2.5, 39],
    ["X rod in two LM8UU, carriage body", 41, my + x_rod_dy + 4, z_rod],
    ["X belt ends clamped under carriage", 34.5, my + xbelt_y + 9, 29],
    ["M3 guide screw; head is the up-stop", 26, my + 2.5, 22],
    ["X belt return run", 18, my + xbelt_y + 3, 18.2],
    ["plywood base", -6, my + 50, -6]
  ];
  for (l = lead) {
    label(l[0], yl, l[1]);
    lead_line(l[2], l[3], yl - 1.5, l[1]);
  }
  // height scale on the left
  ys = my - 52;
  for (h = [[0, "z 0  base top"], [z_shaft, str("z ", z_shaft, "  pulley axes")], [z_flat, str("z ", r1(z_flat), "  belt top, flat underside")],
            [z_rod, str("z ", r1(z_rod), "  all four rods")], [z_board, str("z ", z_board, "  top underside")]]) {
    label(h[1], ys - 2, h[0], 2.8, "right");
    lead_line(ys, h[0], ys + 14, h[0]);
  }
}

// ---------- Top view notes ----------
// Cell centres, the area the magnet can reach, and names of the main parts.
module top_labels() {
  z = z_board + top_t + 2;
  color("#1d4ed8") for (i = [0 : grid_cols - 1], j = [0 : grid_rows - 1])
    translate([cell_cx(i), cell_cy(j), z]) cylinder(d = 2.5, h = 0.5, $fn = 12);
  color("#1d4ed8") translate([0, 0, z]) linear_extrude(0.5) difference() {
    translate([soft_x0, soft_y0]) square([grbl_x, grbl_y]);
    translate([soft_x0 + 1, soft_y0 + 1]) square([grbl_x - 2, grbl_y - 2]);
  }
  notes = [
    ["Y motor", 98, 22], ["Y idler", 60, 462], ["X motor (rides on the gantry)", 98, my + 62],
    ["X idler is under the end block", 360, my - 58],
    ["X endstop", 470, my + 50], ["Y endstop", 452, 440], ["home corner: X max, Y max", 360, 488],
    ["blue frame: GRBL soft limits", 150, 60], ["dots: cell centres", 150, 46]
  ];
  for (n = notes) color("#111") translate([n[1], n[2], z]) linear_extrude(0.5) text(n[0], size = 8.5, font = "Liberation Sans:style=Bold");
  // names written on the end blocks themselves
  on = [["motor", xL - 6, my + 4], ["end block", xL - 6, my - 8], ["idler", xR - 27, my + 4], ["end block", xR - 27, my - 8]];
  for (n = on) color("white") translate([n[1], n[2], z]) linear_extrude(0.5) text(n[0], size = 7, font = "Liberation Sans:style=Bold");
}

// ---------- Collision check ----------
// Overlap of moving parts with fixed parts, and of the carriage with the
// rest of the gantry, at the four ends of travel. Belts and the bearings on
// their rods touch by design and are left out.
module collide_at(gx, gy) {
  intersection() {
    translate([0, gy, 0]) gantry_solid(gx);
    fixed_solid();
  }
  intersection() {
    translate([0, gy, 0]) translate([gx, 0, 0]) carriage_solid();
    translate([0, gy, 0]) gantry_frame_solid();
  }
}
module gantry_frame_solid() {
  end_block_motor(); end_block_idler(); x_motor_mount(); x_endstop_mount();
  translate([x_pulley, eb_rear_L + mm_plate_t, z_shaft]) rotate([90, 0, 0]) nema17();
  translate([x_pulley, xbelt_y - pulley_off, z_shaft]) rotate([-90, 0, 0]) pulley();
  translate([x_idler, xbelt_y, z_shaft]) rotate([90, 0, 0]) idler();
  multmatrix(xe_matrix) es_solid();
  for (s = [-1, 1]) translate([ybelt_x, s * clamp_len / 2, clamp_bottom]) rotate([0, 0, 90]) belt_clamp();
}
module es_solid() {
  cube(es_pcb);
  box(es_lb_body);
  box(es_lb_conn);
}
module carriage_solid() {
  carriage();
  translate([0, 0, z_board - 0.2]) translate([0, 0, -mag_h]) cylinder(d = mag_d, h = mag_h);
  translate([0, 0, z_board - 0.2 - mag_h + mag_thread_engage - guide_screw_len]) m3_screw(guide_screw_len);
  for (t = [-1, 1]) translate([t * clamp_dx, xbelt_y, clamp_bottom]) belt_clamp();
}
module gantry_solid(gx) {
  gantry_frame_solid();
  translate([gx, 0, 0]) carriage_solid();
}
module fixed_solid() {
  translate([xL, 0, 0]) y_rod_holder();
  translate([xL, base_d, 0]) mirror([0, 1, 0]) y_rod_holder();
  translate([xR, holder_d, 0]) rotate([0, 0, 180]) y_rod_holder();
  translate([xR, base_d, 0]) rotate([0, 0, 180]) y_rod_holder();
  y_motor_mount(); y_endstop_mount();
  translate([ybelt_x + 5.5 + ym_plate_t, ymotor_y, z_shaft]) rotate([0, -90, 0]) nema17();
  translate([ybelt_x + pulley_off, ymotor_y, z_shaft]) rotate([0, -90, 0]) pulley();
  // the Y idler mount at both ends of its tensioning slide
  for (d = [0, yidler_slide]) translate([0, d, 0]) {
    y_idler_mount();
    translate([ybelt_x, yidler_y, z_shaft]) rotate([0, 90, 0]) idler();
  }
  multmatrix(ye_matrix) es_solid();
  translate([0, 0, -base_t]) cube([base_w, base_d, base_t]);
  translate([-wall_t, -wall_t, z_board]) cube([base_w + 2 * wall_t, base_d + 2 * wall_t, top_t]);
  translate([-wall_t, base_d, -base_t]) cube([base_w + 2 * wall_t, wall_t, base_t + z_board]);
  translate([-wall_t, -wall_t, -base_t]) cube([base_w + 2 * wall_t, wall_t, base_t + z_board]);
  translate([base_w, 0, -base_t]) cube([wall_t, base_d, base_t + z_board]);
  translate([-wall_t, 0, -base_t]) cube([wall_t, base_d, base_t + z_board]);
}

// ---------- Output ----------
// Furthest the gantry can go: the switch bodies are the hard stops on the
// home side, es_trigger - es_body = 1.5 mm past the point where they trip.
x_hard_max = x_home + es_trigger - es_body - 0.05;
y_hard_max2 = min(y_hard_max, y_home + es_trigger - es_body - 0.05);
if (check == "collide") {
  for (gx = [x_hard_min, x_hard_max], gy = [y_hard_min - check_push, y_hard_max2]) collide_at(gx, gy);
} else if (view == "section") {
  // magnet axis moved to x = 0, y = 0 so the section camera never changes
  translate([-mx, -my, 0]) {
    machine();
    if (labels) section_labels();
  }
} else {
  machine();
  if (labels && view == "top") top_labels();
}

// ---------- Checks ----------
function r1(v) = round(v * 10) / 10;

need_x0 = sheet_x0 + square / 2;           // outermost cell centres, machine X
need_x1 = sheet_x0 + sheet_w - square / 2;
need_y0 = sheet_y0 + square / 2;
need_y1 = sheet_y0 + sheet_d - square / 2;
margin_x = min(need_x0 - soft_x0, soft_x1 - need_x1);
margin_y = min(need_y0 - soft_y0, soft_y1 - need_y1);

echo(str("CHECK reach X: cell centres ", r1(need_x0), "..", r1(need_x1), " (sheet x 20..380); GRBL's soft limits ($130=", grbl_x,
  ") let the magnet reach ", r1(soft_x0), "..", r1(soft_x1), ", margin ", r1(margin_x), " mm each side: ", margin_x >= min_margin ? "OK" : "FAIL"));
echo(str("CHECK reach Y: cell centres ", r1(need_y0), "..", r1(need_y1), " (sheet y 20..300); GRBL's soft limits ($131=", grbl_y,
  ") let the magnet reach ", r1(soft_y0), "..", r1(soft_y1), ", margin ", r1(margin_y), " mm each side: ", margin_y >= min_margin ? "OK" : "FAIL"));
// x_hard_min / y_hard_min leave 1 mm between the parts.
echo(str("CHECK soft limits stop short of the hard stops: X ", r1(soft_x0), " (hard stop ", r1(x_hard_min), "), Y ", r1(soft_y0),
  " (hard stop ", r1(y_hard_min), "); the largest settings that fit are $130=", floor(x_home - x_hard_min), " and $131=",
  floor(y_home - y_hard_min), ": ", (soft_x0 >= x_hard_min && soft_y0 >= y_hard_min) ? "OK" : "FAIL"));

// Highest moving parts other than the magnet, against the top sagging by sag_allow.
moving_top = max(z_parts_top + mm_lip[0], sleeve_top, z_shaft + nema_w / 2);
echo(str("CHECK top clearance: highest moving parts (sleeve rim, X motor mount lip) z = ", r1(moving_top), ", top underside z = ", z_board,
  ", clearance ", r1(z_board - moving_top), " mm flat, ", r1(z_board - sag_allow - moving_top), " mm with ", sag_allow,
  " mm sag: ", z_board - sag_allow - moving_top >= 1 ? "OK" : "FAIL"));

seat = z_flat + floor_t - spring_pocket_h;
spring_work = z_board - mag_h - seat;
spring_sag = spring_work - sag_allow;
mag_stop_bottom = z_flat + guide_screw_len - mag_thread_engage;   // screw head against the floor
spring_stop = mag_stop_bottom - seat;
echo(str("CHECK magnet spring: length ", r1(spring_work), " mm at the top's edge height, ", r1(spring_sag), " mm with ",
  sag_allow, " mm sag, ", r1(spring_stop), " mm at the up-stop (free length ", spring_free, "): ",
  (spring_stop < spring_free && spring_sag > 5) ? "OK" : "FAIL"));
echo(str("CHECK magnet up-stop: with the top off the magnet rises ", r1(mag_stop_bottom + mag_h - z_board),
  " mm above the top's underside and stays ", r1(sleeve_top - mag_stop_bottom), " mm inside the sleeve: ",
  (mag_stop_bottom + mag_h > z_board && sleeve_top - mag_stop_bottom >= 5) ? "OK" : "FAIL"));

// Moving envelope (all travel) against the frame: the walls stand outside the base.
env_x0 = xL - house_hw;
env_x1 = xR + house_hw;
env_y0 = y_hard_min - eb_half;
env_y1 = y_hard_max + eb_rear_L + mm_plate_t + nema_len;
echo(str("CHECK frame: moving parts sweep x ", r1(env_x0), "..", r1(env_x1), ", y ", r1(env_y0), "..", r1(env_y1),
  "; walls are outside 0..", base_w, " x 0..", base_d, ": ",
  (env_x0 > 0 && env_x1 < base_w && env_y0 > 0 && env_y1 < base_d) ? "OK" : "FAIL"));

// Belts. The pulleys' tooth bands come from where the stand-ins are placed
// (pulley_off) and how long their teeth are; the belt has to fit between
// the flanges (1 mm each). Axle heights (all z_shaft) and the upper runs
// lying on the flat undersides (z_flat = belt_top) hold by construction.
x_band = xbelt_y - pulley_off + pulley_teeth_len / 2;  // X pulley tooth band centre, gantry y
y_band = ybelt_x + pulley_off - pulley_teeth_len / 2;  // Y pulley tooth band centre, machine x
band_room = (pulley_teeth_len - 2 - belt_w) / 2;
belt_off = max(abs(x_band - xbelt_y), abs(y_band - ybelt_x));
return_top = z_shaft - (pulley_tip_d / 2 - belt_tooth);  // lower runs, tooth side
head_bottom = clamp_bottom - m3_head_h;                  // belt clamp screw heads
echo(str("CHECK belts: pulley tooth bands ", r1(belt_off), " mm off the belt lines with ", r1(band_room),
  " mm to spare each side of the ", belt_w, " mm belt; idlers ", idler_w - 2, " mm between flanges; return runs (top z ",
  r1(return_top), ") ", r1(head_bottom - return_top), " mm below the clamp screw heads: ",
  (belt_off <= band_room && idler_w - 2 >= belt_w && head_bottom - return_top >= 1) ? "OK" : "FAIL"));

// ---------- Box checks ----------
// Bounding boxes [[x0, y0, z0], [x1, y1, z1]] of the parts. Gantry parts are
// in gantry Y; carriage parts are centred on the magnet axis.
function ov(a, b) = a[0][0] < b[1][0] && b[0][0] < a[1][0] && a[0][1] < b[1][1] && b[0][1] < a[1][1] && a[0][2] < b[1][2] && b[0][2] < a[1][2];
function mv(b, d) = [b[0] + d, b[1] + d];
function mvb(list, d) = [for (b = list) [b[0], mv(b[1], d)]];
// Overlap in the two axes other than k.
function ov2(a, b, k) = let(i = (k + 1) % 3, j = (k + 2) % 3) a[0][i] < b[1][i] && b[0][i] < a[1][i] && a[0][j] < b[1][j] && b[0][j] < a[1][j];
// [gap, names] from each mover box to each box ahead of it along +k.
function gaps(movers, others, k) = [for (m = movers, o = others)
  if (ov2(m[1], o[1], k) && o[1][1][k] > m[1][1][k]) [o[1][0][k] - m[1][1][k], str(m[0], " / ", o[0])]];
function nearest(g) = let(m = min([for (x = g) x[0]])) [m, [for (x = g) if (x[0] == m) x[1]][0]];
// Largest gap along any one axis between two boxes (negative: they overlap).
function sep(a, b) = max([for (k = [0 : 2]) max(b[0][k] - a[1][k], a[0][k] - b[1][k])]);

ym_px = ybelt_x + 5.5;   // Y motor mount plate, pulley side
x_sw_box = ["X switch body", es_box(xe_matrix, es_lb_body)];
y_sw_box = ["Y switch body", es_box(ye_matrix, es_lb_body)];
gantry_rest = [
  ["motor end block, housing", [[xL - house_hw, -eb_half, z_flat], [xL + house_hw, eb_half, z_parts_top]]],
  ["motor end block, rod block", [[xL + house_hw, -eb_half, z_flat], [eb_face_L, eb_rear_L, z_parts_top]]],
  ["Y belt clamps", [[ybelt_x - clamp_wid / 2, -clamp_len, clamp_bottom - m3_head_h], [ybelt_x + clamp_wid / 2, clamp_len, z_flat]]],
  ["X motor mount", [[mm_x0, eb_rear_L, 3.5], [mm_x1, eb_rear_L + mm_plate_t, z_parts_top]]],
  ["X motor mount lip", [[mm_x0, eb_rear_L - mm_lip[1], z_parts_top], [eb_face_L - 0.5, eb_rear_L + mm_plate_t, z_parts_top + mm_lip[0]]]],
  ["X motor", [[x_pulley - nema_w / 2, eb_rear_L + mm_plate_t, z_shaft - nema_w / 2], [x_pulley + nema_w / 2, eb_rear_L + mm_plate_t + nema_len, z_shaft + nema_w / 2]]],
  ["idler end block", [[eb_face_R, -eb_half, z_flat], [xR + house_hw, eb_half, z_parts_top]]],
  ["idler foot", [[eb_face_R, xbelt_y - idler_slot / 2 - 4, z_shaft - 6], [x_idler + idler_d / 2 + 3, xbelt_y + idler_slot / 2 + 4, z_flat]]],
  ["X idler", [[x_idler - idler_d / 2, xbelt_y - idler_w / 2, z_shaft - idler_d / 2], [x_idler + idler_d / 2, xbelt_y + idler_w / 2, z_shaft + idler_d / 2]]],
  ["X endstop bracket", [[eb_face_R - es_x_plate, xe_br_y[0], es_x_z0], [eb_face_R, xe_br_y[1], z_parts_top]]],
  ["X endstop bracket block", [[eb_face_R, es_x_y0 - 1, es_x_z0], [eb_face_R + xe_br_back, es_x_y0 + es_pcb[1] + 1, z_flat - 0.5]]],
  ["X endstop PCB", es_box(xe_matrix, [[0, 0, 0], es_pcb])],
  ["X endstop connector and plug", es_box(xe_matrix, es_lb_conn)]
];
gantry_boxes = concat(gantry_rest, [x_sw_box]);
carriage_boxes = [
  ["carriage", [[-car_l / 2, -car_hw, z_flat], [car_l / 2, car_hw, sleeve_top]]],
  ["X belt clamps", [[-clamp_dx - clamp_len / 2, xbelt_y - clamp_wid / 2, clamp_bottom - m3_head_h], [clamp_dx + clamp_len / 2, xbelt_y + clamp_wid / 2, z_flat]]],
  ["guide screw head", [[-m3_head_d / 2, -m3_head_d / 2, z_board - mag_h + mag_thread_engage - guide_screw_len - m3_head_h - sag_allow - 3], [m3_head_d / 2, m3_head_d / 2, z_flat]]]
];
ye_y0 = ye_pcb_front + es_pcb[2];   // Y endstop post face
fl_holder = [[xL - holder_w / 2 - holder_flange, 0, 0], [xL + holder_w / 2, holder_d, holder_h]];
bl_holder = [[xL - holder_w / 2 - holder_flange, base_d - holder_d, 0], [xL + holder_w / 2, base_d, holder_h]];
br_holder = [[xR - holder_w / 2, base_d - holder_d, 0], [xR + holder_w / 2 + holder_flange, base_d, holder_h]];
ym_plate = [[ym_px, ymotor_y - 24, 0], [ym_px + ym_plate_t, ymotor_y + 24, z_shaft + nema_w / 2 + 2]];
ym_feet = [[ym_px - 28, ymotor_y - 6, 0], [ym_px + 45, ymotor_y + 34, flange_t]];
// The Y idler mount anywhere along its tensioning slide.
yi_base = [[yim_x0, yidler_y - 20, 0], [yim_x1, yidler_y + 11 + yidler_slide, flange_t]];
yi_cheeks = [[ybelt_x - idler_slot / 2 - 4, yidler_y - 9, 0], [ybelt_x + idler_slot / 2 + 4, yidler_y + 9 + yidler_slide, z_shaft + 6]];
ye_post = [[ye_pcb_x - 1, ye_y0, 0], [ye_pcb_x + es_pcb[1] + 1.5, ye_y0 + 21, ye_pcb_z + es_pcb[0] + 1]];
ye_foot = [[ye_foot_x0, ye_y0, 0], [ye_pcb_x + es_pcb[1] + 1.5, ye_y0 + 24, flange_t]];
fixed_rest = [
  ["front-left holder", fl_holder],
  ["back-left holder", bl_holder],
  ["front-right holder", [[xR - holder_w / 2, 0, 0], [xR + holder_w / 2 + holder_flange, holder_d, holder_h]]],
  ["back-right holder", br_holder],
  ["Y motor mount plate", ym_plate],
  ["Y motor mount tail", [[ym_px, ymotor_y + 24, 0], [ym_px + 17 + ym_plate_t, ymotor_y + 34, 20]]],
  ["Y motor mount feet", ym_feet],
  ["Y motor", [[ym_px + ym_plate_t, ymotor_y - nema_w / 2, z_shaft - nema_w / 2], [ym_px + ym_plate_t + nema_len, ymotor_y + nema_w / 2, z_shaft + nema_w / 2]]],
  ["Y pulley", [[ybelt_x + pulley_off - pulley_len, ymotor_y - pulley_flange_d / 2, z_shaft - pulley_flange_d / 2], [ybelt_x + pulley_off, ymotor_y + pulley_flange_d / 2, z_shaft + pulley_flange_d / 2]]],
  ["Y idler mount", yi_base],
  ["Y idler cheeks", yi_cheeks],
  ["Y idler", [[ybelt_x - idler_w / 2, yidler_y - idler_d / 2, z_shaft - idler_d / 2], [ybelt_x + idler_w / 2, yidler_y + idler_d / 2 + yidler_slide, z_shaft + idler_d / 2]]],
  ["Y endstop post", ye_post],
  ["Y endstop foot", ye_foot],
  ["Y endstop PCB", es_box(ye_matrix, [[0, 0, 0], es_pcb])],
  ["Y endstop connector and plug", es_box(ye_matrix, es_lb_conn)],
  ["base", [[0, 0, -base_t], [base_w, base_d, 0]]],
  ["top", [[-wall_t, -wall_t, z_board], [base_w + wall_t, base_d + wall_t, z_board + top_t]]],
  ["back wall", [[-wall_t, base_d, -base_t], [base_w + wall_t, base_d + wall_t, z_board]]],
  ["front wall", [[-wall_t, -wall_t, -base_t], [base_w + wall_t, 0, z_board]]],
  ["left wall", [[-wall_t, 0, -base_t], [0, base_d, z_board]]],
  ["right wall", [[base_w, 0, -base_t], [base_w + wall_t, base_d, z_board]]]
];
fixed_boxes = concat(fixed_rest, [y_sw_box]);
right_rod = [[xR - rod_d / 2, 0, z_rod - rod_d / 2], [xR + rod_d / 2, base_d, z_rod + rod_d / 2]];

// Endstops: where each switch trips, how far it is then to the switch body
// (the hard stop), and to the nearest other part in the direction of travel.
car_home = mvb(carriage_boxes, [x_home, 0, 0]);
x_body = nearest(gaps(car_home, [x_sw_box], 0));
x_next = nearest(gaps(car_home, gantry_rest, 0));
gantry_home = concat(mvb(gantry_boxes, [0, y_home, 0]),
  mvb(carriage_boxes, [x_hard_min, y_home, 0]), mvb(carriage_boxes, [x_hard_max, y_home, 0]));
y_body = nearest(gaps(gantry_home, [y_sw_box], 1));
y_next = nearest(gaps(gantry_home, fixed_rest, 1));
echo(str("CHECK endstops: X trips at magnet x = ", r1(x_home), ", ", r1(x_body[0]), " mm before the carriage meets the switch body; nearest other part ",
  r1(x_next[0]), " mm (", x_next[1], "). Y trips at magnet y = ", r1(y_home), ", ", r1(y_body[0]),
  " mm before the end block meets the switch body; nearest other part ", r1(y_next[0]), " mm (", y_next[1], "): ",
  (x_body[0] > 0 && x_next[0] > x_body[0] && y_body[0] > 0 && y_next[0] > y_body[0]) ? "OK" : "FAIL"));

// Moving parts against fixed parts, and the carriage against the rest of the
// gantry, at the four corners of travel (conservative; the exact test is
// check = "collide").
corners = [for (gx = [x_hard_min, x_hard_max], gy = [y_hard_min, y_hard_max2]) [gx, gy]];
hits = [
  for (c = corners) each concat(
    [for (g = gantry_boxes, f = fixed_boxes) if (ov(mv(g[1], [0, c[1], 0]), f[1])) str(g[0], " / ", f[0], " at ", c)],
    [for (k = carriage_boxes, f = fixed_boxes) if (ov(mv(k[1], [c[0], c[1], 0]), f[1])) str(k[0], " / ", f[0], " at ", c)],
    [for (k = carriage_boxes, g = gantry_boxes) if (ov(mv(k[1], [c[0], 0, 0]), g[1])) str(k[0], " / ", g[0], " at ", c)]
  )
];
echo(str("CHECK box interference at the four corners of travel: ", len(hits) == 0 ? "none, OK" : str(len(hits), " FAIL ", hits)));

// Fixed parts that sit close to each other (the Y idler mount slid fully
// back, the Y endstop post slid 3 mm back).
fixed_pairs = [
  ["Y motor mount / front-left holder", sep(ym_plate, fl_holder)],
  ["Y motor mount feet / front-left holder", sep(ym_feet, fl_holder)],
  ["Y idler mount / back-left holder", sep(yi_base, bl_holder)],
  ["Y idler cheeks / back-left holder", sep(yi_cheeks, bl_holder)],
  ["Y endstop post / back-right holder", sep(mv(ye_foot, [0, 3, 0]), br_holder)],
  ["Y endstop post / right Y rod", sep(ye_post, right_rod)]
];
fixed_min = min([for (p = fixed_pairs) p[1]]);
echo(str("CHECK fixed parts: ", [for (p = fixed_pairs) str(p[0], " ", r1(p[1]), " mm")], ": ", fixed_min >= 1 ? "OK" : "FAIL"));

echo(str("SIZE footprint ", base_w + 2 * wall_t, " x ", base_d + 2 * wall_t, " mm; height ", base_t + z_board + top_t,
  " mm to the playing surface (", base_t + z_board + top_t + 31.5, " mm to the top of a king)"));
echo(str("SIZE printed sheet corner at machine (", r1(sheet_x0), ", ", r1(sheet_y0), "), ", r1(sheet_x0 + wall_t), " mm from the top's left edge and ",
  r1(sheet_y0 + wall_t), " mm from its front edge; magnet now at (", r1(mx), ", ", r1(my), ")"));
echo(str("SIZE belt loops (pitch line, before clamping): X ", round(2 * (x_idler - x_pulley) + 40), " mm, Y ",
  round(2 * (yidler_y - ymotor_y) + 40), "-", round(2 * (yidler_y + yidler_slide - ymotor_y) + 40), " mm"));
echo(str("SIZE X motor: body ", nema_len, " mm long as drawn; at the Y switch's hard stop its back is ",
  r1(base_d - (y_home + es_trigger - es_body + eb_rear_L + mm_plate_t + nema_len)), " mm from the back wall, so a body up to ",
  floor(base_d - 1 - (y_home + es_trigger - es_body + eb_rear_L + mm_plate_t)), " mm long fits; it runs ", r1(z_shaft - nema_w / 2), " mm above the base"));
