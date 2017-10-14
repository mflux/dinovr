const { scene, events } = VRViewer({THREE, emptyRoom: false, clearColor: 0xe7e6de});
const textureLoader = new THREE.TextureLoader();

const GROUND_SPEED = 0.6;
const CLOUD_SPEED = 0.08;
const GAMEPLAY_RADIUS = 4;
const COLLISION_THRESHOLD = 0.2;

const TWO_PI = Math.PI * 2;
const UP = new THREE.Vector3(0,1,0);
const CENTER = new THREE.Vector3();

const gameState = {
  started: false,
  alive: true
};

const cactiLargeTexture = textureLoader.load( 'art/cacti_large.png' );
cactiLargeTexture.magFilter = cactiLargeTexture.minFilter = THREE.NearestFilter;
const cactiLargeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  side: THREE.DoubleSide,
  map: cactiLargeTexture,
});

const carouselMaterial = new THREE.MeshBasicMaterial({color:0xffffff});
const carouselRingMaterial = new THREE.MeshBasicMaterial({color:0x696969});

const dirtTexture = textureLoader.load( 'art/dirt.png' );
dirtTexture.magFilter = dirtTexture.minFilter = THREE.NearestFilter;
const dirtMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  side: THREE.DoubleSide,
  map: dirtTexture,
});

const dinoTexture = textureLoader.load( 'art/dino.png' );
dinoTexture.magFilter = dinoTexture.minFilter = THREE.NearestFilter;
const dinoMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  map: dinoTexture,
});

const cloudTexture = textureLoader.load( 'art/cloud.png' );
cloudTexture.magFilter = cloudTexture.minFilter = THREE.NearestFilter;
const cloudMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  side: THREE.DoubleSide,
  map: cloudTexture,
});

const carousel = createCarousel();
scene.add( carousel );

const obstacleList = [];
const obstacles = createObstacles();
carousel.add( obstacles );

const clouds = createClouds();
scene.add( clouds );

const dino = createDino();
scene.add( dino );


const physics = {
  position: dino.position,
  velocity: new THREE.Vector3(),
  gravity: new THREE.Vector3(0,-0.5,0),
  jump: new THREE.Vector3(0,8,0),
  airFriction: 0.01,
  reflectFriction: 0.15
};

let jumpHeld = false;
document.addEventListener( 'keydown', function( e ){
  if( gameState.started === false ){
    gameState.started = true;
    playSound( sfx[ 'JUMP' ] );
    return;
  }

  if( gameState.alive === false ){
    reset();
    return;
  }

  if( e.key === ' ' ){
    if( physics.position.y <= 0.2 ){
      jump();
    }
    jumpHeld = true;
    playSound( sfx[ 'JUMP' ] );
  }
});

document.addEventListener( 'keyup', function( e ){
  if( e.key === ' ' ){
    jumpHeld = false;
  }
});

const clock = new THREE.Clock();

events.on( 'tick', function( dt ){
  if( gameState.alive === false || gameState.started === false ){
    return;
  }

  carousel.rotation.y += GROUND_SPEED * dt;
  clouds.rotation.y += CLOUD_SPEED * dt;

  physics.velocity.add( physics.gravity.clone() );
  // physics.velocity.multiplyScalar( (1-physics.airFriction) * dt );

  physics.position.add( physics.velocity.clone().multiplyScalar( dt ) );

  if( physics.position.y < 0 ){
    physics.position.y = 0;
    physics.velocity.set( 0, -physics.velocity.y * physics.reflectFriction, 0 );
  }

  const collision = checkCollision();
  if( collision ){
    gameState.alive = false;
    playSound( sfx[ 'HIT' ] );
  }

  updateAnimation();
});

function reset(){
  gameState.started = false;
  gameState.alive = true;
  physics.position.y = 0;
  physics.velocity.set( 0, 0, 0 );
  jumpHeld = false;
  carousel.rotation.y = 0;
  clouds.rotation.y = 0;
  dino.setSprite( 0 );
}

function jump(){
  physics.velocity.add( physics.jump );
}

function checkCollision(){
  const dinoPos = dino.getWorldPosition();
  // dinoMaterial.color.setRGB( 0, 1, 1 );
  let collide = false;
  obstacleList.forEach( function( obs ){
    const obsPos = obs.getWorldPosition();
    if( obsPos.distanceTo( dinoPos ) < COLLISION_THRESHOLD ){
      // dinoMaterial.color.setRGB( 0.6, 0, 0 );
      collide = true || collide;
    }
  });
  return collide;
}

function updateAnimation(){

  if( gameState.alive === false ){
    dino.setSprite( 3 );
  }
  else
  if( dino.position.y > 0 ){
    dino.setSprite( 0 );
  }
  else{
    const step = Math.floor( clock.getElapsedTime() * 10 ) % 2 === 0;
    if( step ){
      dino.setSprite( 1 );
    }
    else{
      dino.setSprite( 2 );
    }
  }
}

function createCarousel(){
  const mesh = new THREE.Mesh( new THREE.CylinderGeometry( 5,5,0.5,36,1 ), carouselMaterial );
  mesh.geometry.translate( 0, -0.25, 0 );
  mesh.position.y = -0.25;

  const ringMesh = new THREE.Mesh( new THREE.TorusGeometry( 5, 0.01, 3, 36 ), carouselRingMaterial );
  ringMesh.geometry.rotateX( Math.PI * 0.5, 0, 0 );
  mesh.add( ringMesh );

  const dirt = createDirt();
  mesh.add( dirt );

  return mesh;
}

function createObstacles(){
  const group = new THREE.Group();
  while( obstacleList.length < 7 ){
    for( let i=30; i<360; i+=20 ){
      if( Math.random() > 0.7 ){
        const obs = createObstacle();
        const alpha = i / 360;
        const rads = -alpha * TWO_PI + Math.PI * 0.5;
        const x = Math.cos( rads ) * GAMEPLAY_RADIUS;
        const y = -Math.sin( rads ) * GAMEPLAY_RADIUS;
        obs.position.set( x, 0.25, y );

        const mat = new THREE.Matrix4();
        mat.lookAt( obs.position, CENTER, UP );

        obs.rotation.setFromRotationMatrix(mat);
        obstacleList.push( obs );
        group.add( obs );
      }
    }
  }
  return group;
}

function createObstacle(){
  const mesh = createSpriteSheet( cactiLargeMaterial, 25, 64, 128, 64 );
  mesh.setSprite( Math.floor( Math.random() * 3) );
  return mesh;
}

function createDirt(){
  const group = new THREE.Group();
  for( let i=0; i<32; i++ ){
    const dirt = createSpriteSheet( dirtMaterial, 25, 8, 128, 8 );
    const rads = Math.random() * TWO_PI;
    const radius = 0.3 + Math.random() * GAMEPLAY_RADIUS * 0.6;
    const x = Math.cos( rads ) * radius;
    const y = -Math.sin( rads ) * radius;
    dirt.position.set( x, 0.25, y );
    dirt.setSprite( Math.floor( Math.random() * 5 ) );

    const mat = new THREE.Matrix4();
    mat.lookAt( dirt.position, CENTER, UP );

    dirt.rotation.setFromRotationMatrix(mat);
    group.add( dirt );
  }
  return group;
}

function createClouds(){
  const group = new THREE.Group();
  for( let i=0; i<48; i++ ){
    const cloud = createSpriteSheet( cloudMaterial, 64, 64, 64, 64 );
    const rads = Math.random() * TWO_PI;
    const radius = GAMEPLAY_RADIUS + Math.random() * GAMEPLAY_RADIUS * 1.0;
    const height = 0.5 + Math.random() * 3;
    const x = Math.cos( rads ) * radius;
    const y = -Math.sin( rads ) * radius;
    cloud.position.set( x, height, y );

    const mat = new THREE.Matrix4();
    mat.lookAt( cloud.position, CENTER, UP );

    cloud.rotation.setFromRotationMatrix(mat);
    group.add( cloud );
  }
  return group;
}

function extractUV( geometry ){
  const beginVerts = [];
  const endVerts = [];

  geometry.faceVertexUvs[ 0 ].forEach( function( verts ){
    verts.forEach( function( v ){
      if( v.x === 0 ){
        beginVerts.push( v );
      }
      else
      if( v.x === 1 ){
        endVerts.push( v );
      }
    });
  });

  return {
    beginVerts, endVerts
  };
}

function createSpriteSheet( material, spriteWidth, spriteHeight, sheetWidth, sheetHeight ){
  const plane = new THREE.PlaneGeometry( spriteWidth, spriteHeight, 1, 1 );
  plane.scale( 0.01, 0.01, 0.01 );

  const spriteSheetRatio = spriteWidth / sheetWidth;
  const { beginVerts, endVerts } = extractUV( plane );

  const mesh = new THREE.Mesh( plane, material );

  mesh.setSprite = function( spriteIndex ){
    const uStart = spriteIndex * spriteSheetRatio + 0.001;
    const uEnd = (spriteIndex+1) * spriteSheetRatio - 0.001;
    beginVerts.forEach( function(v){
      v.x = uStart;
    });
    endVerts.forEach( function(v){
      v.x = uEnd;
    });
    plane.uvsNeedUpdate = true;
  };

  return mesh;
}

function createDino(){
  const mesh = createSpriteSheet( dinoMaterial, 44, 64, 256, 64 );
  mesh.setSprite( 0 );
  mesh.position.z = -GAMEPLAY_RADIUS + 0.1;
  return mesh;
}

function decodeBase64ToArrayBuffer(base64String) {
  var len = (base64String.length / 4) * 3;
  var str = atob(base64String);
  var arrayBuffer = new ArrayBuffer(len);
  var bytes = new Uint8Array(arrayBuffer);
  for (var i = 0; i < len; i++) {
      bytes[i] = str.charCodeAt(i)
  }
  return bytes.buffer
}

const soundSources = {
  JUMP: 'offline-sound-press',
  HIT: 'offline-sound-hit'
};

const sfx = {};
const audioContext = new AudioContext();

for( let i in soundSources ){
  const sourceId = soundSources[ i ];
  let soundSrc = document.getElementById( sourceId ).src;
  soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1);
  const buffer = decodeBase64ToArrayBuffer(soundSrc);
  audioContext.decodeAudioData( buffer, function(audioData) {
    sfx[ i ] = audioData;
  });
}



function playSound( buffer ){
  if( buffer ){
    var sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(audioContext.destination);
    sourceNode.start(0)
  }
}