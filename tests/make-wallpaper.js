// Draws the wallpaper the tests and the pictures use: hills in the evening fog under a sky with stars, and
// a lighthouse. It has sharp edges and small dots, so that blur shows in a picture, and it is
// drawn here, so that the project ships no picture made by someone else.
//
//   gjs tests/make-wallpaper.js <file.png> [width] [height]
const Cairo = imports.cairo;

const [path, widthArg, heightArg] = ARGV;
if (!path) {
    printerr('usage: gjs tests/make-wallpaper.js <file.png> [width] [height]');
    imports.system.exit(2);
}
const width = Number(widthArg ?? 1920);
const height = Number(heightArg ?? 1080);

// The same picture every time: a fixed seed for the random numbers.
let seed = 20261124;
function random() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
}

const surface = new Cairo.ImageSurface(Cairo.Format.RGB24, width, height);
const cr = new Cairo.Context(surface);

const sky = new Cairo.LinearGradient(0, 0, 0, height);
sky.addColorStopRGB(0, 0.05, 0.06, 0.07);
sky.addColorStopRGB(0.45, 0.16, 0.19, 0.19);
sky.addColorStopRGB(0.72, 0.47, 0.53, 0.50);
sky.addColorStopRGB(0.86, 0.72, 0.77, 0.73);
cr.setSource(sky);
cr.paint();

const glow = new Cairo.RadialGradient(width * 0.70, height * 0.80, 0, width * 0.70, height * 0.80, height * 0.55);
glow.addColorStopRGBA(0, 0.90, 0.93, 0.89, 0.55);
glow.addColorStopRGBA(1, 0.80, 0.86, 0.82, 0.0);
cr.setSource(glow);
cr.paint();

for (let i = 0; i < 320; i++) {
    const x = random() * width;
    const y = random() * height * 0.55;
    const radius = 0.7 + random() * 1.6;
    cr.setSourceRGBA(1, 1, 1, (0.35 + random() * 0.65) * (1 - y / (height * 0.62)));
    cr.arc(x, y, radius, 0, 2 * Math.PI);
    cr.fill();
}

// Ridges from the back to the front, each a sum of a few waves, each darker than the last.
const ridges = [
    {base: 0.66, rise: 0.10, colour: [0.40, 0.45, 0.43]},
    {base: 0.74, rise: 0.09, colour: [0.25, 0.29, 0.28]},
    {base: 0.82, rise: 0.08, colour: [0.14, 0.17, 0.17]},
    {base: 0.90, rise: 0.06, colour: [0.06, 0.07, 0.08]},
];
let front = null;
for (const ridge of ridges) {
    const waves = [1, 2, 3, 5, 8].map(k => ({k, phase: random() * 2 * Math.PI, size: (random() + 0.3) / k}));
    const total = waves.reduce((sum, wave) => sum + wave.size, 0);
    const at = x => {
        const t = x / width;
        const swell = waves.reduce((sum, wave) => sum + wave.size * Math.sin(2 * Math.PI * wave.k * t + wave.phase), 0) / total;
        return height * (ridge.base - ridge.rise * swell);
    };
    cr.moveTo(0, height);
    for (let x = 0; x <= width; x += 4)
        cr.lineTo(x, at(x));
    cr.lineTo(width, height);
    cr.closePath();
    cr.setSourceRGB(...ridge.colour);
    cr.fill();
    front = at;
}

// A lighthouse on the front ridge, with its lamp lit.
const towerX = width * 0.22;
const towerFoot = front(towerX) + 6;
const towerHeight = height * 0.16;
const footWidth = height * 0.034;
const topWidth = height * 0.022;
cr.moveTo(towerX - footWidth / 2, towerFoot);
cr.lineTo(towerX - topWidth / 2, towerFoot - towerHeight);
cr.lineTo(towerX + topWidth / 2, towerFoot - towerHeight);
cr.lineTo(towerX + footWidth / 2, towerFoot);
cr.closePath();
cr.setSourceRGB(0.06, 0.07, 0.08);
cr.fill();
const lampY = towerFoot - towerHeight - topWidth * 0.6;
const lamp = new Cairo.RadialGradient(towerX, lampY, 0, towerX, lampY, height * 0.05);
lamp.addColorStopRGBA(0, 1.0, 1.0, 0.96, 1.0);
lamp.addColorStopRGBA(0.12, 0.95, 0.97, 0.92, 0.85);
lamp.addColorStopRGBA(1, 0.85, 0.90, 0.86, 0.0);
cr.setSource(lamp);
cr.arc(towerX, lampY, height * 0.05, 0, 2 * Math.PI);
cr.fill();
cr.setSourceRGB(0.06, 0.07, 0.08);
cr.rectangle(towerX - topWidth * 0.75, towerFoot - towerHeight - topWidth * 0.1, topWidth * 1.5, topWidth * 0.25);
cr.fill();

surface.writeToPNG(path);
cr.$dispose();
