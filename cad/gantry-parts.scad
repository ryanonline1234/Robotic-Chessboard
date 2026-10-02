// Printed parts for the XY gantry (OpenSCAD).
//
// Every part is modelled where it sits in the machine (see params.scad for
// the coordinate system), so cad/assembly.scad can place them without extra
// offsets. print_part() turns each one to its print orientation on the bed.
//
// Export one part:   openscad -D 'part="carriage"' -o carriage.stl gantry-parts.scad
// See them all:      leave part = "all" (a layout of every printed part)
// Or run cad/export.sh to write every STL and the renders.
//
// Parts: y-rod-holder (print 4), end-block-motor, end-block-idler,
// x-motor-mount, carriage, y-motor-mount, y-idler-mount, belt-clamp (print 4),
// x-endstop-mount, y-endstop-mount.
// PLA, 0.2 mm layers, 4 perimeters, 30% infill; no supports needed.
// idler_bore in params.scad picks the idlers (5 mm bore on M5 axles, or 3 mm
// on M3); it changes end-block-idler and y-idler-mount only.

include <params.scad>

part = "all";
show_names = false; // label each part in the "all" layout
$fn = 40;
eps = 0.01;

// ---------- Helpers ----------

// Circle with a 45-degree roof so a horizontal hole prints without support.
// roof = 1 points the roof to +Z, -1 to -Z (for parts printed upside down).
module tear2d(r, roof = 1) {
  scale([1, roof]) union() {
    circle(r);
    intersection() {
      rotate(45) square(r);
      translate([-r, 0]) square([2 * r, r * 1.15]);
    }
  }
}

module hole_x(d, len, roof = 1) {
  rotate([90, 0, 90]) linear_extrude(height = len, center = true) tear2d(d / 2, roof);
}

module hole_y(d, len, roof = 1) {
  rotate([90, 0, 0]) linear_extrude(height = len, center = true) tear2d(d / 2, roof);
}

module cyl_y(d, len) {
  rotate([90, 0, 0]) cylinder(d = d, h = len, center = true);
}

// Countersunk M3 hole along +Y, countersink on the y = 0 face.
module m3_flat_y(len) {
  rotate([-90, 0, 0]) {
    translate([0, 0, -1]) cylinder(d = m3_clear, h = len + 2);
    translate([0, 0, -eps]) cylinder(d1 = 6.8, d2 = m3_clear, h = 1.7);
  }
}

// Countersunk M3 hole along +X, countersink on the x = 0 face.
module m3_flat_x(len) {
  rotate([0, 90, 0]) {
    translate([0, 0, -1]) cylinder(d = m3_clear, h = len + 2);
    translate([0, 0, -eps]) cylinder(d1 = 6.8, d2 = m3_clear, h = 1.7);
  }
}

// Countersunk wood-screw hole through a plate of thickness t (top at z = t).
module wood_hole(t) {
  translate([0, 0, -1]) cylinder(d = wood_clear, h = t + 2);
  translate([0, 0, t - (wood_head_d - wood_clear) / 2]) cylinder(d1 = wood_clear, d2 = wood_head_d, h = (wood_head_d - wood_clear) / 2 + eps);
}

// Slot along Y for a pan-head wood screw, so the part can slide before tightening.
module wood_slot_y(len, t) {
  hull() for (s = [-1, 1]) translate([0, s * len / 2, -1]) cylinder(d = wood_clear, h = t + 2);
}

// ---------- Y rod holder (print 4) ----------
// Holds one end of a Y rod. Drawn for the front-left corner: rod along Y at
// x = 0, z = z_rod, block from y = 0 to holder_d, screw flange outboard (-X).
// Turn it 180 degrees about Z for the other side. Rod end flush with the
// outer face; an M3 x 6 grub screw in the top locks it.
module y_rod_holder() {
  difference() {
    union() {
      translate([-holder_w / 2, 0, 0]) cube([holder_w, holder_d, holder_h]);
      translate([-holder_w / 2 - holder_flange, 0, 0]) cube([holder_flange + eps, holder_d, flange_t]);
    }
    translate([0, holder_d / 2, z_rod]) hole_y(rod_hole, holder_d + 2, 1);
    translate([0, holder_d / 2, z_rod]) cylinder(d = m3_tap, h = holder_h);
    for (y = [holder_d / 4, 3 * holder_d / 4])
      translate([-holder_w / 2 - holder_flange / 2, y, 0]) wood_hole(flange_t);
  }
}

// ---------- End blocks ----------

// Two LM8UU pressed in from each end against a shoulder in the middle.
module y_bearing_bores(x) {
  inner = eb_lm_c - lm_len / 2;
  translate([x, 0, z_rod]) hole_y(lm_stop_d, 2 * eb_half + 2, -1);
  for (s = [-1, 1])
    translate([x, s * (inner + eb_half + 1) / 2, z_rod]) hole_y(lm_bore, eb_half + 1 - inner, -1);
}

// Left end block: rides the left Y rod, holds the left ends of both X rods,
// carries the X motor (through x_motor_mount) and the two Y belt clamps.
// Machine X, gantry Y. Printed upside down.
module end_block_motor() {
  sock_x0 = xL + house_hw;
  difference() {
    union() {
      translate([xL - house_hw, -eb_half, z_flat]) cube([2 * house_hw, 2 * eb_half, z_parts_top - z_flat]);
      translate([sock_x0 - eps, -eb_half, z_flat]) cube([eb_face_L - sock_x0 + eps, eb_half + eb_rear_L, z_parts_top - z_flat]);
    }
    y_bearing_bores(xL);
    for (s = [-1, 1]) {
      // X rod socket, 1 mm longer than needed so rod length tolerance is no problem
      translate([(rod_x0 - 1 + eb_face_L + 1) / 2, s * x_rod_dy, z_rod]) hole_x(rod_hole, eb_face_L + 2 - rod_x0, -1);
      // two M3 x 6 grub screws lock the X rod, one at each end of the socket
      for (x = [rod_x0 + grub_in, eb_face_L - grub_out]) translate([x, s * x_rod_dy, z_rod]) cylinder(d = m3_tap, h = 20);
      // Y belt clamps: one each side of the middle, two screws each
      for (t = [-1, 1]) translate([ybelt_x + t * clamp_screw, s * clamp_len / 2, z_flat - 1]) cylinder(d = m3_tap, h = clamp_pilot + 1);
    }
    // pocket for the X motor pulley and the upper belt run leaving it
    translate([x_pulley - pulley_flange_d / 2 - 1.5, xbelt_y - 9, z_flat - 1])
      cube([eb_face_L - x_pulley + pulley_flange_d / 2 + 2.5, eb_rear_L - xbelt_y + 10, 3.5]);
    // pilot holes for the two screws that hold the X motor mount
    for (x = mm_screw_x) translate([x, eb_rear_L + 1, mm_screw_z]) rotate([90, 0, 0]) cylinder(d = m3_tap, h = 13);
  }
}

// Right end block: rides the right Y rod, holds the right ends of both X
// rods and the X idler (in a slot underneath). The X endstop bracket screws
// to its inner face. Machine X, gantry Y. Printed upside down.
// The idler axle (M5 x 30 or M3 x 25, see idler_bore in params.scad) goes in
// from the front with its head on the foot's front face, through a washer,
// the idler and a washer, and takes a nut on the back face. An M5 x 30 ends
// about 4 mm behind the end block's back face, under the block.
module end_block_idler() {
  sock_x1 = xR - house_hw;
  foot_x1 = x_idler + idler_d / 2 + 3;
  difference() {
    union() {
      translate([xR - house_hw, -eb_half, z_flat]) cube([2 * house_hw, 2 * eb_half, z_parts_top - z_flat]);
      translate([eb_face_R, -eb_half, z_flat]) cube([sock_x1 - eb_face_R + eps, 2 * eb_half, z_parts_top - z_flat]);
      // foot under the block that carries the idler axle
      translate([eb_face_R, xbelt_y - idler_slot / 2 - idler_cheek, z_shaft - idler_foot_down])
        cube([foot_x1 - eb_face_R, idler_slot + 2 * idler_cheek, z_flat - z_shaft + idler_foot_down + eps]);
    }
    y_bearing_bores(xR);
    for (s = [-1, 1]) {
      translate([(eb_face_R - 1 + rod_x1 + 1) / 2, s * x_rod_dy, z_rod]) hole_x(rod_hole, rod_x1 + 2 - eb_face_R, -1);
      for (x = [rod_x1 - grub_in, eb_face_R + grub_out]) translate([x, s * x_rod_dy, z_rod]) cylinder(d = m3_tap, h = 20);
    }
    // X endstop bracket: the upper PCB screw and the bracket's own screw
    for (p = [[es_x_y0 + es_pcb[1] - es_hole_inset, es_x_z0 + es_hole_inset + es_hole_span], xe_br_screw])
      translate([eb_face_R - 1, p[0], p[1]]) rotate([0, 90, 0]) cylinder(d = m3_tap, h = 9);
    // idler slot, open toward the carriage and underneath
    translate([eb_face_R - 1, xbelt_y - idler_slot / 2, z_shaft - idler_d / 2 - 8])
      cube([x_idler + idler_d / 2 + 1.5 - eb_face_R + 1, idler_slot, idler_d + 8 + 1.25]);
    // idler axle along Y; its roof points down (-Z), which is up on the bed
    translate([x_idler, xbelt_y, z_shaft]) hole_y(axle_clear, idler_slot + 2 * idler_cheek + 2, -1);
  }
}

// ---------- X motor mount ----------
// Plate that holds the X motor behind the left end block. The motor bolts on
// with four countersunk M3 x 10 screws (flush, so the end block sits flat on
// them), then two M3 x 16 screws above the motor fix the plate to the end
// block. The lip along the top rests on the end block, so belt tension can't
// turn the plate about the screws. Fit the pulley to the shaft first: it
// passes through the 22.6 mm hole.
module x_motor_mount() {
  difference() {
    union() {
      translate([mm_x0, eb_rear_L, 3.5]) cube([mm_x1 - mm_x0, mm_plate_t, z_parts_top - 3.5 + eps]);
      translate([mm_x0, eb_rear_L - mm_lip[1], z_parts_top]) cube([eb_face_L - 0.5 - mm_x0, mm_lip[1] + mm_plate_t, mm_lip[0]]);
    }
    translate([x_pulley, eb_rear_L + mm_plate_t / 2, z_shaft]) cyl_y(nema_boss_hole, mm_plate_t + 2);
    for (i = [-1, 1], j = [-1, 1])
      translate([x_pulley + i * nema_pitch / 2, eb_rear_L, z_shaft + j * nema_pitch / 2]) m3_flat_y(mm_plate_t);
    for (x = mm_screw_x) translate([x, eb_rear_L + mm_plate_t / 2, mm_screw_z]) cyl_y(m3_clear, mm_plate_t + 2);
  }
}

// ---------- Magnet carriage ----------
// Rides the two X rods on four LM8UU. The magnet slides in the sleeve, pushed
// up by a light spring sitting in the pocket on the floor; an M3 screw through
// the floor into the magnet's back is its guide pin and up-stop. The two X belt
// ends are clamped underneath. Centred on the magnet axis. Printed upright.
module carriage() {
  difference() {
    union() {
      translate([-car_l / 2, -car_hw, z_flat]) cube([car_l, 2 * car_hw, z_parts_top - z_flat]);
      translate([0, 0, z_flat]) cylinder(d = sleeve_id + 2 * sleeve_wall, h = sleeve_top - z_flat, $fn = 64);
    }
    for (s = [-1, 1]) {
      translate([0, s * x_rod_dy, z_rod]) hole_x(lm_stop_d, car_l + 2, 1);
      for (t = [-1, 1]) translate([t * (car_l / 2 - lm_len / 2 + 0.5), s * x_rod_dy, z_rod]) hole_x(lm_bore, lm_len + 1 + eps, 1);
      // X belt clamps
      for (t = [-1, 1]) translate([t * clamp_dx, xbelt_y + s * clamp_screw, z_flat - 1]) cylinder(d = m3_tap, h = clamp_pilot + 1);
    }
    // magnet sleeve, spring pocket, guide screw
    translate([0, 0, z_flat + floor_t]) cylinder(d = sleeve_id, h = 40, $fn = 64);
    translate([0, 0, z_flat + floor_t - spring_pocket_h]) cylinder(d = spring_pocket_d, h = spring_pocket_h + eps);
    translate([0, 0, z_flat - 1]) cylinder(d = m3_clear + 0.2, h = floor_t + 2);
    // slot for the magnet's two wires, toward the motor end
    translate([-car_l / 2 - 1, -2, z_flat + floor_t]) cube([car_l / 2 + 1, 4, 40]);
  }
}

// ---------- Y motor mount ----------
// Holds the Y motor at the front left with its shaft pointing outboard, so
// the pulley sits under the left bearing housing. Fix the motor to the mount
// (four countersunk M3 x 10, flush) before screwing the mount to the base.
// The outboard foot reaches past the Y rod so its screw can be driven with
// the rod in place. Printed upright.
module y_motor_mount() {
  px = ybelt_x + 5.5;        // pulley-side face of the plate
  y0 = ymotor_y - 24;
  y1 = ymotor_y + 24;
  difference() {
    union() {
      translate([px, y0, 0]) cube([ym_plate_t, y1 - y0, z_shaft + nema_w / 2 + 2]);
      // outboard foot under the pulley, out past the Y rod
      translate([px - 28, y1 - 30, 0]) cube([28 + eps, 30, flange_t]);
      // low tail behind the motor, and the inboard foot
      translate([px, y1 - eps, 0]) cube([ym_plate_t, 10, 20]);
      translate([px, y1, 0]) cube([45, 10, flange_t]);
      // gussets
      for (y = [y1 - 30, y1 - 4]) translate([px + eps, y, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
        linear_extrude(4) polygon([[0, 0], [-12, 0], [0, 13]]);
      translate([px + ym_plate_t - eps, y1 + 4, 0]) rotate([90, 0, 0]) linear_extrude(4) polygon([[0, 0], [17, 0], [0, 19]]);
    }
    translate([px - 1, ymotor_y, z_shaft]) hole_x(nema_boss_hole, 3 * ym_plate_t, 1);
    for (i = [-1, 1], j = [-1, 1])
      translate([px, ymotor_y + i * nema_pitch / 2, z_shaft + j * nema_pitch / 2]) m3_flat_x(ym_plate_t);
    translate([px - 22, y1 - 9, 0]) wood_hole(flange_t);
    for (x = [px + 28, px + 39]) translate([x, y1 + 5, 0]) wood_hole(flange_t);
  }
}

// ---------- Y idler mount ----------
// Fork for the Y idler at the back left, drawn at its front stop. The two
// slots let it slide back up to yidler_slide (6 mm) to tension the belt
// before the wood screws are tightened; the back-left rod holder is 1 mm
// behind it at the end of that travel. Both screws sit outboard of the Y rod.
// The X motor passes 1.35 mm from the inboard cheek, so nothing may stick out
// of that side. The axle (M5 x 20 or M3 x 18, see idler_bore in params.scad)
// goes in from the outboard side: through the outboard cheek and a nut that
// sits in a pocket on the cheek's inner face, then a washer, the idler and a
// washer, and ends inside the inboard cheek. Tightening it clamps the
// outboard cheek between the screw head and the nut. Printed upright.
module y_idler_mount() {
  x_in = ybelt_x - idler_slot / 2;   // inside faces of the cheeks
  x_out = ybelt_x + idler_slot / 2;
  difference() {
    union() {
      translate([yim_x0, yidler_y - 20, 0]) cube([yim_x1 - yim_x0, 31, flange_t]);
      translate([yim_out_face, yidler_y - yim_cheek_hw, 0]) cube([x_in - yim_out_face, 2 * yim_cheek_hw, z_shaft + yim_cheek_up]);
      translate([x_out, yidler_y - yim_cheek_hw, 0]) cube([yim_in_face - x_out, 2 * yim_cheek_hw, z_shaft + yim_cheek_up]);
    }
    // axle hole through both cheeks, and the nut pocket (a flat on top)
    translate([(yim_out_face + yim_in_face) / 2, yidler_y, z_shaft]) hole_x(axle_clear, yim_in_face - yim_out_face + 2, 1);
    translate([x_in + eps, yidler_y, z_shaft]) rotate([0, -90, 0]) rotate([0, 0, 30])
      cylinder(d = nut_pocket_d, h = nut_pocket + eps, $fn = 6);
    // both screws outboard of the rod and the belt, so you can reach them to re-tension it
    for (y = [yidler_y - 12, yidler_y + 4]) translate([yim_slot_x, y, 0]) wood_slot_y(yidler_slide, flange_t);
  }
}

// ---------- Belt clamp (print 4) ----------
// Two clamp the X belt ends under the carriage, two clamp the Y belt ends
// under the left end block. Ridges sit between the belt teeth. Belt along X.
module belt_clamp() {
  difference() {
    union() {
      translate([-clamp_len / 2, -clamp_wid / 2, 0]) cube([clamp_len, clamp_wid, clamp_t]);
      for (i = [-3 : 3]) translate([i * 2 - 0.4, -(belt_w + 0.5) / 2, clamp_t - eps]) cube([0.8, belt_w + 0.5, belt_tooth]);
    }
    for (s = [-1, 1]) translate([0, s * clamp_screw, -1]) cylinder(d = m3_clear, h = clamp_t + 2);
  }
}

// ---------- Endstop mounts ----------
// Both PCBs stand on end, switch at the top, connector at the bottom. The
// part that presses the lever stops above the connector, so the plug never
// gets in its way. A pocket behind each PCB clears its solder pins. If your
// board's holes are elsewhere, drill new 2.9 mm pilots.

// X: bracket on the inner face of the right end block, facing the carriage.
// The top PCB screw (M3 x 12) goes through the bracket into the end block;
// the bottom one (M3 x 12) cuts its thread in the block under the end block.
// A countersunk M3 x 10 beside the PCB holds the bracket too. Printed with
// the PCB face down.
module x_endstop_mount() {
  x0 = eb_face_R - es_x_plate;                  // PCB side
  yh = es_x_y0 + es_pcb[1] - es_hole_inset;     // the PCB's holes
  zh = [es_x_z0 + es_hole_inset, es_x_z0 + es_hole_inset + es_hole_span];
  difference() {
    union() {
      translate([x0, xe_br_y[0], es_x_z0]) cube([es_x_plate, xe_br_y[1] - xe_br_y[0], es_pcb[0]]);
      translate([eb_face_R - eps, es_x_y0 - 1, es_x_z0]) cube([xe_br_back + eps, es_pcb[1] + 2, z_flat - 0.5 - es_x_z0]);
    }
    translate([x0 - 1, es_x_y0 + 1, es_x_z0 + 1.5]) cube([es_relief + 1, es_pcb[1] - es_hole_inset - 4, es_pcb[0] - 3]);
    translate([x0 - 1, yh, zh[0]]) rotate([0, 90, 0]) cylinder(d = m3_tap, h = es_x_plate + xe_br_back + 2);
    translate([x0 - 1, yh, zh[1]]) rotate([0, 90, 0]) cylinder(d = m3_clear, h = es_x_plate + 2);
    translate([x0, xe_br_screw[0], xe_br_screw[1]]) m3_flat_x(es_x_plate);
  }
}

// Y: post on the base at the back right, facing the gantry; the right end
// block's back face presses the switch. The PCB screws (M3 x 6) cut their
// thread in the post; the slots in the foot let you slide the post to set
// where it trips. Printed upright.
module y_endstop_mount() {
  y0 = ye_pcb_front + es_pcb[2];                // post face, against the PCB
  x0 = ye_pcb_x - 1;
  x1 = ye_pcb_x + es_pcb[1] + 1.5;              // 1.5 mm short of the right Y rod
  zt = ye_pcb_z + es_pcb[0] + 1;
  xh = ye_pcb_x + es_hole_inset;                // the PCB's holes
  difference() {
    union() {
      translate([x0, y0, 0]) cube([x1 - x0, 5, zt]);
      translate([ye_foot_x0, y0, 0]) cube([x1 - ye_foot_x0, 24, flange_t]);
      for (x = [x0, x1 - 4]) translate([x, y0 + 5 - eps, 0]) rotate([90, 0, 90]) linear_extrude(4) polygon([[0, 0], [16, 0], [0, 40]]);
    }
    // pocket for the solder pins, roof at 45 degrees
    hull() {
      translate([xh + 3, y0 - 1, ye_pcb_z + 1.5]) cube([es_pcb[1] - es_hole_inset - 4, 1, es_pcb[0] - 3]);
      translate([xh + 3, y0 - 1, ye_pcb_z + 1.5]) cube([es_pcb[1] - es_hole_inset - 4, es_relief + 1, es_pcb[0] - 3 - es_relief]);
    }
    for (z = [ye_pcb_z + es_hole_inset, ye_pcb_z + es_hole_inset + es_hole_span])
      translate([xh, y0 - 1, z]) rotate([-90, 0, 0]) cylinder(d = m3_tap, h = 6);
    for (x = [ye_foot_x0 + 6, ye_foot_x0 + 16]) translate([x, y0 + 14, 0]) wood_slot_y(6, flange_t);
  }
}

// ---------- Print orientation and layout ----------

// Each part turned to its print orientation and moved near the origin.
module print_part(name) {
  if (name == "y-rod-holder")
    translate([holder_w / 2 + holder_flange, 0, 0]) y_rod_holder();
  else if (name == "end-block-motor")
    translate([-(xL - house_hw), eb_rear_L, z_parts_top]) rotate([180, 0, 0]) end_block_motor();
  else if (name == "end-block-idler")
    translate([-eb_face_R, eb_half, z_parts_top]) rotate([180, 0, 0]) end_block_idler();
  else if (name == "x-motor-mount")
    translate([-mm_x0, -3.5, eb_rear_L + mm_plate_t]) rotate([-90, 0, 0]) x_motor_mount();
  else if (name == "carriage")
    translate([car_l / 2, car_hw, -z_flat]) carriage();
  else if (name == "y-motor-mount")
    translate([-(ybelt_x + 5.5 - 28), -(ymotor_y - 24), 0]) y_motor_mount();
  else if (name == "y-idler-mount")
    translate([-yim_x0, -(yidler_y - 20), 0]) y_idler_mount();
  else if (name == "belt-clamp")
    translate([clamp_len / 2, clamp_wid / 2, 0]) belt_clamp();
  else if (name == "x-endstop-mount")
    translate([es_x_z0 + es_pcb[0], -xe_br_y[0], -(eb_face_R - es_x_plate)]) rotate([0, -90, 0]) x_endstop_mount();
  else if (name == "y-endstop-mount")
    translate([-ye_foot_x0, -(ye_pcb_front + es_pcb[2]), 0]) y_endstop_mount();
}

part_names = ["y-rod-holder", "end-block-motor", "end-block-idler", "x-motor-mount",
  "carriage", "y-motor-mount", "y-idler-mount", "belt-clamp", "x-endstop-mount", "y-endstop-mount"];

// Every printed part, with the right count of the repeated ones.
module layout() {
  // [name, x, y, label]
  items = [
    ["end-block-motor", 0, 0, "end-block-motor"], ["end-block-idler", 75, 0, "end-block-idler"],
    ["carriage", 150, 0, "carriage"], ["x-motor-mount", 0, 120, "x-motor-mount"],
    ["y-motor-mount", 65, 120, "y-motor-mount"], ["y-idler-mount", 150, 120, "y-idler-mount"],
    ["x-endstop-mount", 0, 230, "x-endstop-mount"], ["y-endstop-mount", 55, 230, "y-endstop-mount"]
  ];
  for (it = items) translate([it[1], it[2], 0]) print_part(it[0]);
  for (i = [0 : 3]) translate([115 + (i % 2) * 36, 230 + floor(i / 2) * 26, 0]) print_part("y-rod-holder");
  for (i = [0 : 3]) translate([195 + (i % 2) * 20, 230 + floor(i / 2) * 26, 0]) print_part("belt-clamp");
  if (show_names) color("#222") {
    for (it = items) translate([it[1], it[2] - 10, 0]) linear_extrude(0.6) text(it[3], size = 4.5, font = "Liberation Sans");
    translate([115, 220, 0]) linear_extrude(0.6) text("y-rod-holder x4", size = 4.5, font = "Liberation Sans");
    translate([195, 220, 0]) linear_extrude(0.6) text("belt-clamp x4", size = 4.5, font = "Liberation Sans");
  }
}

if (part == "all") layout();
else print_part(part);
