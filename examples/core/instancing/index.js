/* global window, document, LumaGL */
/* eslint-disable no-var, max-statements */
window.webGLStart = function() {

  var createGLContext = LumaGL.createGLContext;
  var getShadersFromHTML = LumaGL.addons.getShadersFromHTML;
  var Buffer = LumaGL.Buffer;
  var Program = LumaGL.Program;
  var Cube = LumaGL.Cube;
  var Mat4 = LumaGL.Mat4;
  var Vec3 = LumaGL.Vec3;
  var Fx = LumaGL.Fx;

  var canvas = document.getElementById('render-canvas');

  var gl = createGLContext({canvas});

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 1, 1, 1);
  gl.clearDepth(1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  var side = 256;
  var offsets = [];
  var colors = [];
  for (var i = 0; i < side; i++) {
    var x = (-side + 1) * 3 / 2 + i * 3;
    for (var j = 0; j < side; j++) {
      var y = (-side + 1) * 3 / 2 + j * 3;
      var c = [
        Math.random() * 0.75 + 0.25,
        Math.random() * 0.75 + 0.25,
        Math.random() * 0.75 + 0.25
      ];
      offsets.push(x, y);
      colors.push(...c);
    }
  }

  var instanceCount = side * side;

  var cube = new Cube({
    program: new Program(gl, getShadersFromHTML({
      vs: 'cube-vs',
      fs: 'cube-fs'
    })),
    attributes: {
      instanceOffsets: {
        value: new Float32Array(offsets),
        size: 2,
        instanced: 1
      },
      instanceColors: {
        value: new Float32Array(colors),
        size: 3,
        instanced: 1
      }
    },
    isInstanced: 1,
    instanceCount
  });

  var tick = 0;

  var view = new Mat4();

  var projection = new Mat4();

  function render() {
    tick++;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    view.lookAt(
      new Vec3(
        Math.cos(tick * 0.005) * side / 2,
        Math.sin(tick * 0.006) * side / 2,
        (Math.sin(tick * 0.0035) + 1) * side / 4 + 32),
      new Vec3(0, 0, 0),
      new Vec3(0, 1, 0)
    );
    projection.perspective(60, canvas.width / canvas.height, 1, 2048.0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var matrix = new Mat4()
      .$rotateXYZ(tick * 0.01, 0, 0)
      .$rotateXYZ(0, tick * 0.013, 0);

    cube
      .setUniforms({
        uModel: matrix,
        uView: view,
        uProjection: projection,
        uTime: tick * 0.1
      });

    cube.render();

    Fx.requestAnimationFrame(render);
  }

  render();
};
