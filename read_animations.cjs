const fs = require('fs');

const data = fs.readFileSync('public/Modelos da Internet/glTF/Casual_Male.gltf', 'utf8');
const gltf = JSON.parse(data);

if (gltf.animations) {
    console.log("Animations found:");
    gltf.animations.forEach(anim => console.log(anim.name));
} else {
    console.log("No animations found in this file.");
}
