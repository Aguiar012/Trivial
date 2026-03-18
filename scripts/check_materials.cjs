const fs = require('fs');

const data = fs.readFileSync('public/Modelos da Internet/glTF/Suit_Male.gltf', 'utf8');
const gltf = JSON.parse(data);

console.log("Animations:");
if (gltf.animations) {
    gltf.animations.forEach(anim => console.log(anim.name));
}
