// Slim chess pieces for the robotic chessboard (OpenSCAD).
//
// The base is 19 mm across: 0.475 of a 40 mm square, so pieces slide
// between each other and the planner never has to move a blocker.
// Glue a steel M8 washer (16 mm across, 1.6 mm thick) into the pocket under
// each base for the electromagnet to grab, then cover it with a felt pad.
//
// Export one piece:  openscad -D 'piece="knight"' -o knight.stl pieces.scad
// Preview all six:   leave piece = "set"
// Print: 0.2 mm layers, 15-20% infill. Print 2 extra queens for promotions.

piece = "set"; // pawn, rook, knight, bishop, queen, king, or set

base_d = 19;
base_h = 4;
washer_d = 16.4; // M8 washer plus clearance
washer_h = 1.8;
$fn = 64;

module base() {
  difference() {
    cylinder(d = base_d, h = base_h);
    translate([0, 0, -0.01]) cylinder(d = washer_d, h = washer_h + 0.01);
  }
}

module stem(h, d_bottom = 12, d_top = 7) {
  translate([0, 0, base_h]) cylinder(d1 = d_bottom, d2 = d_top, h = h);
}

module collar(z, d = 10) {
  translate([0, 0, z]) cylinder(d = d, h = 1.5);
}

module pawn() {
  stem(8);
  collar(base_h + 8);
  translate([0, 0, base_h + 13]) sphere(d = 9);
}

module rook() {
  stem(12, 12, 10);
  translate([0, 0, base_h + 12]) difference() {
    cylinder(d = 12, h = 6);
    translate([0, 0, 4]) cylinder(d = 7, h = 3);
    for (a = [0, 45, 90, 135]) rotate([0, 0, a]) translate([-7, -1, 4]) cube([14, 2, 3]);
  }
}

module knight() {
  stem(6, 12, 10);
  translate([0, 0, base_h + 6]) hull() {
    translate([-3.5, -3, 0]) cube([7, 6, 1]);
    translate([-4, -2.5, 12]) cube([5, 5, 4]);
    translate([3, -2, 8]) cube([4, 4, 3]);
  }
}

module bishop() {
  stem(9);
  collar(base_h + 9);
  difference() {
    translate([0, 0, base_h + 15]) scale([1, 1, 1.5]) sphere(d = 8);
    translate([0, 0, base_h + 16]) rotate([0, 35, 0]) translate([-5, -0.75, 0]) cube([10, 1.5, 4]);
  }
  translate([0, 0, base_h + 21.5]) sphere(d = 3);
}

module queen() {
  stem(14);
  collar(base_h + 14);
  translate([0, 0, base_h + 15.5]) cylinder(d1 = 8, d2 = 11, h = 5);
  for (i = [0 : 7]) rotate([0, 0, i * 45]) translate([4.8, 0, base_h + 20.5]) sphere(d = 2.2);
  translate([0, 0, base_h + 22]) sphere(d = 4);
}

module king() {
  stem(14);
  collar(base_h + 14);
  translate([0, 0, base_h + 15.5]) cylinder(d1 = 8, d2 = 10.5, h = 5);
  translate([0, 0, base_h + 20.5]) cylinder(d = 10.5, h = 1);
  translate([-0.9, -0.9, base_h + 21.5]) cube([1.8, 1.8, 6]);
  translate([-2.5, -0.9, base_h + 24]) cube([5, 1.8, 1.8]);
}

module chess_piece(name) {
  base();
  if (name == "pawn") pawn();
  else if (name == "rook") rook();
  else if (name == "knight") knight();
  else if (name == "bishop") bishop();
  else if (name == "queen") queen();
  else if (name == "king") king();
}

if (piece == "set") {
  names = ["pawn", "rook", "knight", "bishop", "queen", "king"];
  for (i = [0 : len(names) - 1]) translate([i * 24, 0, 0]) chess_piece(names[i]);
} else {
  chess_piece(piece);
}
