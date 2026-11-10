// Los mismos casos que TicketParserTest.kt de la app (generados a partir de él). Ejecutar: node --test tests/ticket.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseRows, mergeParts } from "../g/ticket.js";

const pizzeria = [
"6/10/2026 21:46:49",
"SALON S10",
"** PRE-TICKET **",
"CONTADO",
"Cant. Descripcion Precio Importe",
"5 AGUA 1/2L. 1,80 9,00",
"2 COCA COLA ZERO 2,60 5,20",
"1 NESTEA 2,60 2,60",
"1 PEQ. NAPOLITANA CON 7,00 7,00",
"1 PEQ. CURRY 7,00 7,00",
"1 PEQ. SALMÓN 7,00 7,00",
"1 PEQ. LA PIZZA 7,00 7,00",
"1 PEQ.BIANCA 7,40 7,40",
"2 CAJA PIZZA PARA LLEVAR 0,50 1,00",
"1 TINTO VERANO 2,00 2,00",
"1 MED. RÚSTICA 9,50 9,50",
"1 MED. 4 QUESOS 9,50 9,50",
"2 CAMPERO SERRANITO 7,40 14,80",
"2 SIN TOMATE",
"BASE TIPO CUOTA TOTAL",
"80,91 10% 8,09 89,00",
"Total: 89,00",
"***** Gracias por su visita *****"
];
function box(text, l, t, r, b, angle) { const v = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)); return { text, centerX: (l + r) / 2, centerY: (t + b) / 2, width: v ? b - t : r - l, height: v ? r - l : b - t, angle }; }
const tedi = [box("******k******0981", 13, 521, 78, 770, 1.405),
box("MASTERCARD", 52, 566, 106, 725, 1.405),
box("TID:", 94, 318, 125, 377, 1.554),
box("8188 Ma laga Ruiz Jimenez", 138, 447, 217, 834, 1.449),
box("00634710", 159, 832, 204, 955, 1.421),
box("Neto sin IVA", 284, 306, 331, 506, 1.500),
box("21,00 % IVA", 322, 320, 375, 501, 1.476),
box("A", 351, 574, 376, 589, 1.571),
box("14,00", 357, 707, 395, 782, 1.517),
box("11,57", 334, 891, 375, 958, 1.493),
box("Cambio", 409, 302, 446, 401, 1.571),
box("Otras Tarjetas", 452, 300, 499, 532, 1.528),
box("2,43", 375, 888, 412, 958, 1.571),
box("0,00", 449, 890, 494, 955, 1.490),
box("14,00", 492, 886, 533, 955, 1.511),
box("TOTAL", 531, 299, 596, 381, 1.558),
box("14,00", 560, 866, 637, 948, 1.546),
box("386500010810000", 686, 297, 730, 543, 1.514),
box("Marcos y cuadroS", 723, 296, 770, 557, 1.513),
box("4,00", 718, 878, 754, 937, 1.536),
box("A", 758, 799, 785, 811, 1.571),
box("386500010810000", 807, 297, 849, 539, 1.525),
box("Marcos y cuadr0s", 843, 296, 888, 553, 1.520),
box("4,00", 835, 871, 870, 930, 1.536),
box("A", 875, 793, 901, 805, 1.571),
box("386500010810000", 926, 296, 966, 535, 1.529),
box("Marcos y cuadros", 960, 295, 1006, 548, 1.515),
box("4,00", 951, 865, 983, 924, 1.571),
box("A", 991, 787, 1015, 799, 1.571),
box("989370013110000", 1042, 294, 1081, 531, 1.533),
box("Papel de regalo", 1077, 293, 1118, 530, 1.541),
box("2,00", 1062, 858, 1097, 917, 1.501),
box("A", 1102, 781, 1127, 794, 1.571),
box("V81880001000000017967", 1161, 436, 1201, 758, 1.537),
box("Factura simplificada:", 1195, 436, 1240, 753, 1.536),
box("EUR", 1141, 871, 1170, 914, 1.571),
box("Caja:1", 1303, 291, 1335, 378, 1.536),
box("Tienda8188 Fecha:08/10/2026 / 19:06:33", 1265, 292, 1319, 875, 1.533),
box("Recib21279 Cajero/a: 269549", 1307, 462, 1356, 903, 1.532),
box("Calle Doctor Ruiz Jiménez 1", 1445, 401, 1490, 801, 1.526),
box("TEDi Comercio S.L.U.", 1479, 449, 1517, 739, 1.522),
box("Tienda 8188", 1385, 524, 1417, 687, 1.540),
box("29010 Málaga", 1417, 508, 1450, 685, 1.548)];
const L = (text, centerX, centerY, width, height, angle) => ({ text, centerX, centerY, width, height, angle });
const pizzeriaOcr = [L("0:53", 119.0, 62.0, 76.0, 32.0, -0.0263),
L("Distro", 122.5, 218.0, 140.0, 42.0, 0.0143),
L("Haz una foto del ticket o súbela desde la galería. Si es", 571.0, 389.0, 1040.0, 36.0, 0.0000),
L("muy largo, puedes usar hasta 5 fotos.", 409.0, 453.0, 716.0, 40.0, 0.0000),
L("1 de 5 fotos", 138.5, 2135.0, 153.0, 28.0, 0.0000),
L("2", 310.5, 1590.0, 11.0, 20.0, 0.0000),
L("5", 334.0, 1021.0, 10.0, 16.0, 0.0000),
L("2", 332.0, 1060.5, 10.0, 17.0, 0.0000),
L("1", 331.0, 1103.0, 10.0, 18.0, 0.0000),
L("1", 330.5, 1145.5, 9.0, 17.0, 0.0000),
L("1", 331.0, 1191.0, 10.0, 18.0, 0.0000),
L("1", 331.0, 1234.5, 10.0, 17.0, 0.0000),
L("1", 330.5, 1278.5, 9.0, 17.0, 0.0000),
L("1", 330.0, 1322.0, 8.0, 18.0, 0.0000),
L("2", 328.5, 1365.5, 9.0, 17.0, 0.0000),
L("Descripcion", 442.0, 979.5, 156.0, 23.0, 0.0000),
L("AGUA 1/2L.", 438.5, 1022.5, 127.0, 21.0, 0.0000),
L("NESTEA", 415.5, 1101.5, 85.0, 21.0, -0.0235),
L("PRE-TICKET *", 598.0, 862.0, 178.0, 22.0, 0.0000),
L("Ssin validez a efectos fiscal es)", 651.0, 881.0, 317.0, 19.0, 0.0095),
L("CONTADO", 592.0, 912.0, 113.0, 15.0, 0.0088),
L("COCA COLA ZERO", 471.0, 1061.0, 196.0, 18.0, 0.0000),
L("PEQ. CURRY", 441.5, 1192.0, 137.0, 20.0, 0.0000),
L("PEQ. NAPOLITANA CON", 507.5, 1147.0, 269.0, 20.0, 0.0000),
L("6/1o/2026 214649", 635.5, 793.0, 221.0, 14.0, 0.0000),
L("SALON S10", 589.5, 810.0, 119.0, 16.0, 0.0000),
L("a tendió: CAJA", 604.0, 827.5, 153.0, 14.0, 0.0065),
L("PEQ. SALMÓN", 452.5, 1233.5, 159.0, 25.0, 0.0000),
L("PEQ.BIANCA", 442.0, 1320.5, 138.0, 21.0, -0.0145),
L("PEQ. LA PIZZA", 453.0, 1279.0, 160.0, 20.0, 0.0000),
L("CAJA PIZZA PARA LLEVAR", 516.0, 1362.0, 290.0, 19.0, -0.0172),
L("1 TINTO VERANO", 433.5, 1408.0, 217.1, 21.0, -0.0230),
L("MED. RÚSTI CA", 448.0, 1451.0, 164.0, 24.0, -0.0244),
L("1 MED. 4 QUESOS", 437.5, 1497.5, 219.0, 25.0, 0.0000),
L("SIN TOMATE", 439.0, 1591.0, 153.0, 22.0, 0.0131),
L("CAMPERO SERRANITO", 489.0, 1544.5, 269.0, 22.0, 0.0186),
L("+ Foto", 322.5, 2386.0, 98.0, 26.0, 0.0204),
L("80,91", 407.5, 1708.5, 63.0, 27.0, 0.0000),
L("BASE TIPO CUOTA", 548.5, 1667.5, 348.0, 37.0, 0.0057),
L("10%", 549.5, 1714.0, 49.0, 26.0, 0.0000),
L("Precio \\m porte", 800.5, 989.5, 178.5, 23.2, 0.0785),
L("8,09", 696.5, 1720.5, 53.0, 27.0, 0.0000),
L("Total:", 679.5, 1841.0, 104.0, 31.0, 0.0096),
L("1,80", 762.0, 1023.5, 44.0, 19.0, 0.0000),
L("Leer ticket", 610.5, 2584.5, 167.0, 27.0, 0.0000),
L("2,60", 763.5, 1061.5, 45.0, 19.0, 0.0000),
L("2,60", 764.5, 1103.0, 47.0, 22.0, 0.0000),
L("7,00", 766.0, 1143.5, 48.0, 23.0, 0.0000),
L("7,00", 766.5, 1186.0, 49.0, 22.0, 0.0000),
L("7,00", 767.5, 1228.0, 49.0, 22.0, 0.0000),
L("7,00", 767.5, 1270.5, 49.0, 21.0, 0.0000),
L("7,40", 769.0, 1314.5, 48.0, 21.0, 0.0000),
L("0,50", 770.0, 1359.5, 50.0, 21.0, 0.0000),
L("2,00", 770.0, 1406.5, 48.0, 23.0, 0.0000),
L("9,50", 772.0, 1455.0, 52.0, 24.0, 0.0000),
L("9,50", 773.0, 1504.0, 52.0, 24.0, 0.0000),
L("***** Gracias por Su visita *** &*", 580.0, 1918.0, 481.1, 23.0, 0.0229),
L("9,00", 872.5, 1033.5, 43.0, 19.0, 0.0000),
L("5,20", 877.0, 1069.5, 42.0, 19.0, 0.0000),
L("2,60", 881.5, 1107.5, 43.0, 21.0, 0.0000),
L("7,00", 884.5, 1147.0, 47.0, 22.0, 0.0000),
L("7,00", 887.5, 1188.5, 47.0, 21.0, 0.0000),
L("7,00", 890.5, 1230.5, 47.0, 23.0, 0.0000),
L("7,00", 893.5, 1274.5, 49.0, 23.0, 0.0000),
L("7,40", 894.0, 1319.5, 48.0, 23.0, 0.0000),
L("1,00", 898.0, 1364.0, 48.0, 22.0, 0.0000),
L("2,00", 899.0, 1410.5, 48.0, 23.0, 0.0000),
L("9,50", 901.5, 1459.0, 51.0, 24.0, 0.0000),
L("9,50", 906.0, 1507.5, 54.0, 25.0, 0.0000),
L("7,40 14,80", 842.5, 1555.0, 189.0, 30.0, 0.0000),
L("TOTAL", 861.0, 1679.5, 97.0, 29.0, 0.0206),
L("89,00", 877.5, 1727.0, 71.0, 28.0, 0.0000),
L("The request failed to complete in the allotted time.", 536.0, 2237.5, 974.0, 43.0, 0.0000),
L("89,00", 887.0, 1849.0, 97.0, 34.0, 0.0206),
L("Subir fotos", 896.0, 2386.5, 176.0, 27.0, 0.0000)];

const sum = (t) => t.items.reduce((a, i) => a + i.totalCents, 0);

test("ticket de restaurante", () => {
  const t = parseRows(pizzeria);
  assert.equal(t.items.length, 13);
  assert.equal(sum(t), 8900);
  assert.equal(t.printedTotalCents, 8900);
  assert.equal(t.items[0].name, "AGUA 1/2L");
  assert.equal(t.items[0].quantity, 5);
  assert.equal(t.items[0].totalCents, 900);
  assert.equal(t.items.at(-1).name, "CAMPERO SERRANITO");
  assert.equal(t.items.at(-1).quantity, 2);
});

test("bar de tapas con columna de unidades", () => {
  const t = parseRows(["LA PIARDA TAPAS", "Fecha: 16/10/2026 15:29:53", "MWEsa I2. 32", "Comensales: 6", "Articulo Precio Und. Importe",
    "Caña+Tapa 4,20 € X2 8,40 €", "Tinto Ver. Limont 4,50 € X2 9,00 €", "Agua+Tapa 4,00 € X3 12,00 €", "Bravas P. Tejo 10,50 € X1 10,50 €",
    "Pan Bao 0,00 €", "Pita X3 0,00 €", "Albondigas x1 0,00 €", "Tapa Extra 3,20 € X7 22,40 €", "Total 62, 30 €", "Base Imponible 56,64 e", "IVA/TAX 5,66 €"]);
  assert.equal(t.printedTotalCents, 6230);
  assert.deepEqual(t.items.map((i) => i.name), ["Caña+Tapa", "Tinto Ver. Limont", "Agua+Tapa", "Bravas P. Tejo", "Tapa Extra"]);
  assert.deepEqual(t.items.map((i) => i.quantity), [2, 2, 3, 1, 7]);
  assert.equal(sum(t), 6230);
});

test("deduce la cantidad sin columna", () => { assert.equal(parseRows(["CERVEZA 2,50 7,50"]).items[0].quantity, 3); });
test("arregla erratas del OCR", () => { assert.equal(parseRows(["1 NESTEA 2, 6O 2,6O"]).items[0].totalCents, 260); });
test("el descuento se resta del anterior", () => { assert.equal(parseRows(["1 PIZZA 10,00", "DTO. PROMO -2,00"]).items[0].totalCents, 800); });

const pairs = (t) => t.items.map((i) => [i.name, i.totalCents]);
test("producto al peso en una línea", () => {
  assert.deepEqual(parseRows(["PLATANO 0,456 kg x 2,99 €/kg 1,36"]).items, [{ id: 0, name: "PLATANO 0,456 kg", quantity: 1, totalCents: 136 }]);
});
test("producto al peso con el nombre en la línea de arriba (Mercadona)", () => {
  const t = parseRows(["1 PLATANO", "0,456 kg 2,99 €/kg 1,36", "1 TOMATE ENSALADA", "1,000 kg 1,50 €/kg 1,50", "2 LECHE ENTERA 1 L 0,89 1,78", "TOTAL 4,64"]);
  assert.deepEqual(pairs(t), [["PLATANO 0,456 kg", 136], ["TOMATE ENSALADA 1,000 kg", 150], ["LECHE ENTERA 1 L", 178]]);
  assert.deepEqual(t.items.map((i) => i.quantity), [1, 1, 2]);
  assert.equal(t.printedTotalCents, 464);
});
test("producto al peso con el detalle en la línea de abajo", () => {
  assert.deepEqual(pairs(parseRows(["TOMATE 1,50", "0,502 kg x 2,99 €/kg", "PAN 0,95"])), [["TOMATE 0,502 kg", 150], ["PAN", 95]]);
});
test("un peso con dos decimales no es un precio", () => {
  assert.deepEqual(parseRows(["UVA BLANCA 0,45 kg x 3,98 1,79"]).items, [{ id: 0, name: "UVA BLANCA 0,45 kg", quantity: 1, totalCents: 179 }]);
});
test("un pack de botellas sigue siendo unidades", () => {
  const i = parseRows(["AGUA 1,5 L x6 3,00"]).items[0];
  assert.equal(i.quantity, 6);
  assert.equal(i.totalCents, 300);
});

test("columnas sueltas y foto girada 4°", () => {
  const a = 4 * Math.PI / 180;
  const at = (text, x, y, w) => ({ text, centerX: x * Math.cos(a) - y * Math.sin(a), centerY: x * Math.sin(a) + y * Math.cos(a), width: w, height: 30, angle: a });
  const rows = [["AGUA 1/2L.", ["5", "1,80", "9,00"]], ["COCA COLA ZERO", ["2", "2,60", "5,20"]], ["NESTEA", ["1", "2,60", "2,60"]]];
  const lines = rows.flatMap(([name, n], i) => { const y = 100 + i * 40; return [at(n[0], 20, y, 15), at(name, 200, y, 250), at(n[1], 480, y, 60), at(n[2], 580, y, 60)]; })
    .sort(() => Math.random() - 0.5);
  const t = parse(lines);
  assert.deepEqual(t.items.map((i) => i.name), ["AGUA 1/2L", "COCA COLA ZERO", "NESTEA"]);
  assert.deepEqual(t.items.map((i) => i.quantity), [5, 2, 1]);
  assert.equal(sum(t), 1680);
});

test("supermercado en horizontal con códigos de barras (OCR real)", () => {
  const t = parse(tedi);
  assert.deepEqual(t.items.map((i) => { const s = i.name.toLowerCase(); return s[0].toUpperCase() + s.slice(1); }), ["Papel de regalo", "Marcos y cuadros", "Marcos y cuadros", "Marcos y cuadros"]);
  assert.deepEqual(t.items.map((i) => i.totalCents), [200, 400, 400, 400]);
  assert.equal(t.printedTotalCents, 1400);
});

test("restaurante con el papel curvado (OCR real)", () => {
  const t = parse(pizzeriaOcr);
  assert.equal(t.items.length, 13);
  assert.equal(t.items[0].totalCents, 900);
  assert.equal(sum(t), 8900);
  assert.equal(t.printedTotalCents, 8900);
});

const line = (name, totalCents, quantity = 1) => ({ id: 0, name, quantity, totalCents });
test("fotos solapadas: lo repetido una vez", () => {
  const m = mergeParts([[line("Leche", 95), line("Pan", 120), line("Huevos", 210)], [line("Pan", 120), line("Huev0s", 210), line("Aceite", 899)]]);
  assert.deepEqual(m.map((i) => i.name), ["Leche", "Pan", "Huevos", "Aceite"]);
  assert.deepEqual(m.map((i) => i.id), [0, 1, 2, 3]);
});
test("fotos sin solape se juntan", () => { assert.deepEqual(mergeParts([[line("Leche", 95)], [line("Pan", 120)]]).map((i) => i.name), ["Leche", "Pan"]); });
test("mismo nombre y otro precio no es solape", () => { assert.equal(mergeParts([[line("Cerveza", 150)], [line("Cerveza", 300, 2)]]).length, 2); });
