import {WebGL} from './webgl-types';
import {Texture} from './texture';
import assert from 'assert';

// TODO - use tables to reduce complexity of method below
/* eslint-disable max-len */
const UNIFORM_BASE_DESCRIPTORS = {
  [WebGL.FLOAT]: {function: 'uniform1f', type: Float32Array},
  [WebGL.INT]: {function: 'uniform1i', type: Uint16Array},
  [WebGL.BOOL]: {function: 'uniform1i', type: Uint16Array},
  [WebGL.FLOAT_VEC2]: {function: 'uniform2fv', type: Float32Array, elements: 2},
  [WebGL.FLOAT_VEC3]: {function: 'uniform3fv', type: Float32Array, elements: 3},
  [WebGL.FLOAT_VEC4]: {function: 'uniform4fv', type: Float32Array, elements: 4},
  [WebGL.INT_VEC2]: {function: 'uniform2iv', type: Uint16Array, elements: 2},
  [WebGL.INT_VEC3]: {function: 'uniform3iv', type: Uint16Array, elements: 3},
  [WebGL.INT_VEC4]: {function: 'uniform4iv', type: Uint16Array, elements: 4},
  [WebGL.BOOL_VEC2]: {function: 'uniform2iv', type: Uint16Array, elements: 2},
  [WebGL.BOOL_VEC3]: {function: 'uniform3fv', type: Uint16Array, elements: 3},
  [WebGL.BOOL_VEC4]: {function: 'uniform4iv', type: Uint16Array, elements: 4},
  [WebGL.FLOAT_MAT2]: {function: 'uniformMatrix2fv', type: Float32Array, matrix: true, elements: 4},
  [WebGL.FLOAT_MAT3]: {mfunction: 'uniformMatrix3fv', type: Float32Array, matrix: true, elements: 9},
  [WebGL.FLOAT_MAT4]: {function: 'uniformMatrix4fv', type: Float32Array, matrix: true, elements: 16},
  [WebGL.SAMPLER_2D]: {function: 'uniform1i', type: Uint16Array, texture: true},
  [WebGL.SAMPLER_CUBE]: {function: 'uniform1i', type: Uint16Array, texture: true}
};
/* eslint-enable max-len */

export function parseUniformName(name) {
  // name = name[name.length - 1] === ']' ?
  // name.substr(0, name.length - 3) : name;

  // if array name then clean the array brackets
  const UNIFORM_NAME_REGEXP = /([^\[]*)(\[[0-9]+\])?/;
  const matches = name.match(UNIFORM_NAME_REGEXP);
  if (!matches || matches.length < 2) {
    throw new Error(`Failed to parse GLSL uniform name ${name}`);
  }

  return {
    name: matches[1],
    length: matches[2] || 1,
    isArray: Boolean(matches[2])
  };
}

// Returns a Magic Uniform Setter
/* eslint-disable complexity */
export function getUniformSetter(gl, location, info) {
  const descriptor = UNIFORM_BASE_DESCRIPTORS[info.type];
  if (!descriptor) {
    throw new Error(`Unknown GLSL uniform type ${info.type}`);
  }

  const glFunction = gl[descriptor.function].bind(gl);
  const TypedArray = descriptor.type;

  // How many data elements does app need to provide
  const flatArrayLength = info.size * (descriptor.elements || 1);

  // console.log('getSetter', location, info, flatArrayLength);

  // Set a uniform array
  let setter;
  if (flatArrayLength > 1) {
    setter = val => {
      if (!(val instanceof TypedArray)) {
        const typedArray = new TypedArray(flatArrayLength);
        typedArray.set(val);
        val = typedArray;
      }
      assert(val.length === flatArrayLength);
      if (descriptor.matrix) {
        // Second param: whether to transpose the matrix. Must be false.
        glFunction(location, false, val);
      } else {
        glFunction(location, val);
      }
    };
  } else {
    setter = val => glFunction(location, val);
  }

  // Set a primitive-valued uniform
  return setter;
}

// Basic checks of uniform values without knowledge of program
// To facilitate early detection of e.g. undefined values in JavaScript
export function checkUniformValues(uniforms, source) {
  for (const uniformName in uniforms) {
    const value = uniforms[uniformName];
    if (!checkUniformValue(value)) {
      // Add space to source
      source = source ? `${source} ` : ``;
      /* eslint-disable no-console */
      /* global console */
      // Value could be unprintable so write the object on console
      console.error(`${source} Bad uniform ${uniformName}`, value);
      /* eslint-enable no-console */
      throw new Error(`${source} Bad uniform ${uniformName}`);
    }
  }
  return true;
}

function checkUniformValue(value) {
  let ok = true;

  // Test for texture (for sampler uniforms)
  // WebGL2: if (value instanceof Texture || value instanceof Sampler) {
  if (value instanceof Texture) {
    ok = true;
  // Check that every element in array is a number, and at least 1 element
  } else if (Array.isArray(value)) {
    for (const element of value) {
      if (!isFinite(element)) {
        ok = false;
      }
    }
    ok = ok && (value.length > 0);
  // Typed arrays can only contain numbers, but check length
  } else if (ArrayBuffer.isView(value)) {
    ok = value.length > 0;
  // Check that single value is a number
  } else if (!isFinite(value)) {
    ok = false;
  }

  return ok;
}

// Prepares a table suitable for console.table
export function getUniformsTable({
  header = 'Uniforms',
  program,
  uniforms
} = {}) {
  assert(program);

  const uniformLocations = program._uniformSetters;
  const table = {[header]: {}};

  // Add program's provided uniforms
  for (const uniformName in uniformLocations) {
    const uniform = uniforms[uniformName];
    if (uniform !== undefined) {
      table[uniformName] = {
        Type: uniform,
        Value: uniform.toString()
      };
    }
  }

  // Add program's unprovided uniforms
  for (const uniformName in uniformLocations) {
    const uniform = uniforms[uniformName];
    if (uniform === undefined) {
      table[uniformName] = {
        Type: 'NOT PROVIDED',
        Value: 'N/A'
      };
    }
  }

  // List any unused uniforms
  for (const uniformName in uniforms) {
    const uniform = uniforms[uniformName];
    if (!table[uniformName]) {
      table[uniformName] = {
        Type: 'NOT USED: ' + uniform,
        Value: uniform.toString()
      };
    }
  }

  return table;
}

/*
  if (vector) {
    switch (type) {
    case WebGL.FLOAT:
      glFunction = gl.uniform1f;
      break;
    case WebGL.FLOAT_VEC2:
      glFunction = gl.uniform2fv;
      TypedArray = isArray ? Float32Array : new Float32Array(2);
      break;
    case WebGL.FLOAT_VEC3:
      glFunction = gl.uniform3fv;
      TypedArray = isArray ? Float32Array : new Float32Array(3);
      break;
    case WebGL.FLOAT_VEC4:
      glFunction = gl.uniform4fv;
      TypedArray = isArray ? Float32Array : new Float32Array(4);
      break;
    case WebGL.INT:
    case WebGL.BOOL:
    case WebGL.SAMPLER_2D:
    case WebGL.SAMPLER_CUBE:
      glFunction = gl.uniform1i;
      break;
    case WebGL.INT_VEC2:
    case WebGL.BOOL_VEC2:
      glFunction = gl.uniform2iv;
      TypedArray = isArray ? Uint16Array : new Uint16Array(2);
      break;
    case WebGL.INT_VEC3:
    case WebGL.BOOL_VEC3:
      glFunction = gl.uniform3iv;
      TypedArray = isArray ? Uint16Array : new Uint16Array(3);
      break;
    case WebGL.INT_VEC4:
    case WebGL.BOOL_VEC4:
      glFunction = gl.uniform4iv;
      TypedArray = isArray ? Uint16Array : new Uint16Array(4);
      break;
    case WebGL.FLOAT_MAT2:
      matrix = true;
      glFunction = gl.uniformMatrix2fv;
      break;
    case WebGL.FLOAT_MAT3:
      matrix = true;
      glFunction = gl.uniformMatrix3fv;
      break;
    case WebGL.FLOAT_MAT4:
      matrix = true;
      glFunction = gl.uniformMatrix4fv;
      break;
    default:
      break;
    }
  }
*/