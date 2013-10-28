function ObjFace(){
  this.vi = new Array();
  this.ti = new Array();
  this.ni = new Array();

  this.normal = vec3.create();
}

ObjFace.prototype.addIndices = function(vi, ti, ni){
  this.vi.push(vi);

  if(!isNaN(ti)){
    this.ti.push(ti);
  }

  if(!isNaN(ni)){
    this.ni.push(ni);
  }
}

ObjFace.prototype.correction = function(vLookupSize, tLookupSize, nLookupSize){
  var i;
  for(i=0; i<this.vi.length; ++i){
    if(this.vi[i] < 0)
      this.vi[i] = vLookupSize + this.vi[i];
    else
      this.vi[i]--;
  }

  for(i=0; i<this.ti.length; ++i){
    if(this.ti[i] < 0)
      this.ti[i] = tLookupSize + this.ti[i];
    else
      this.ti[i]--;
  }

  for(i=0; i<this.ni.length; ++i){
    if(this.ni[i] < 0)
      this.ni[i] = nLookupSize + this.ni[i];
    else
      this.ni[i]--;
  }
}

ObjFace.prototype.calculateFaceNormal = function(vLookup){
  var m = vec3.sub(vec3.create(), vLookup[this.vi[1]], vLookup[this.vi[0]]);
  var n = vec3.sub(vec3.create(), vLookup[this.vi[2]], vLookup[this.vi[0]]);
  vec3.cross(this.normal, m, n);
  vec3.normalize(this.normal, this.normal);
}

ObjFace.prototype.calculateSmoothNormal = function(vLookup, nLookup){
  this.calculateFaceNormal(vLookup)

  // accumulate the normals for every vertices on the face.
  for(var i=0; i<this.vi.length; ++i){
    var vertexNormal = nLookup[this.vi[i]];
    if(vertexNormal)
      vec3.add(nLookup[this.vi[i]], vertexNormal, this.normal);
    else
      nLookup[this.vi[i]] = vec3.clone(this.normal);
  }
}



function ObjLoader(flatShading){
  if(flatShading)
    this.flatShading = flatShading;
  else
    this.flatShading = false;
  console.log(this.flatShading);
}
var p = ObjLoader.prototype;

p.load = function(path, callback){
  this.callback = callback;

  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  xhr.onload = bind(this, this.onload);
  xhr.send();
}

p.onload = function(e){
  console.time('split');

  var lines = e.target.responseText.split('\n');

  // keeping token string of the line
  var tokens, parts;
  // for loop index
  var i,j,k,len;

  // vertex, texture coordinates, normals and faces
  this.vertices = new Array();
  this.texCoords = new Array();
  this.normals = new Array();
  // indices
  this.indices = new Array();

  var faces = new Array();

  // temporary look up array
  var vLookup = new Array();
  var tLookup = new Array();
  var nLookup = new Array();

  // texture coordinate component size.
  this.texCoordComponentSize = 2;

  // temp element for vertex, texture coordinates and normal.
  var element;

  len = lines.length;
  for(var i=0; i<len; ++i){
    var line = lines[i];

    // empty line and comments
    if(line.trim() == '' || line.charAt(0) == '#')
      continue;

    switch(line.substr(0, 2)){
      case 'v ':
        tokens = line.substr(1).trim().split(' ');
        element = new Float32Array(tokens.length);
        for(j=0; j<tokens.length; ++j){
          element[j] = Number(tokens[j]);
        }
        vLookup.push(element);
        break;
      case 'vt':
        tokens = line.substr(2).trim().split(' ');
        this.texCoordComponentSize = tokens.length;
        element = new Float32Array(tokens.length);
        for(j=0; j<tokens.length; ++j){
          element[j] = Number(tokens[j]);
        }
        tLookup.push(element);
        break;
      case 'vn':
        tokens = line.substr(2).trim().split(' ');
        element = new Float32Array(tokens.length);
        for(j=0; j<3; ++j){
          element[j] = Number(tokens[j]);
        }
        nLookup.push(element);
        break;
      case 'f ':
        var vi = new Array();
        var ti = new Array();
        var ni = new Array();
        tokens = line.substr(1).trim().split(' ');
        for(j=0; j<tokens.length; ++j){
          parts = tokens[j].split('/');

          vi.push(parseInt(parts[0]));
          ti.push(parseInt(parts[1]));
          ni.push(parseInt(parts[2]));
        }

        var face = new ObjFace();
        face.addIndices(vi[0], ti[0], ni[0]);
        face.addIndices(vi[1], ti[1], ni[1]);
        face.addIndices(vi[2], ti[2], ni[2]);
        faces.push(face);

        if(vi.length === 4){
          face = new ObjFace();
          face.addIndices(vi[2], ti[2], ni[2]);
          face.addIndices(vi[3], ti[3], ni[3]);
          face.addIndices(vi[0], ti[0], ni[0]);
          faces.push(face);
        }
        break;
    }
  }

  len = faces.length;
  for(i=0; i<len; ++i){
    faces[i].correction(vLookup.length, tLookup.length, nLookup.length);
  }

  // if no normals definition. Generate one.
  if(nLookup.length === 0){
    if(this.flatShading){
      for(i=0; i<len; ++i){
        var face = faces[i];
        face.calculateFaceNormal(vLookup);
        nLookup.push(face.normal);

        for(j=0; j<face.vi.length; ++j){
          face.ni[j] = nLookup.length-1;
        }
      }
    }
    else{
      for(i=0; i<len; ++i){
        faces[i].calculateSmoothNormal(vLookup, nLookup);
        faces[i].ni = faces[i].vi;
      }

      for(i=0; i<nLookup.length; ++i){
        if(nLookup[i])
          vec3.normalize(nLookup[i], nLookup[i]);
      }
    }
  }

  for(i=0; i<len; ++i){
    var face = faces[i];

    // vertices
    for(j=0; j<face.vi.length; ++j){
      element = vLookup[face.vi[j]];
      for(k=0; k<element.length; ++k){
        this.vertices.push(element[k]);
      }
    }

    // texture coordinate
    for(j=0; j<face.ti.length; ++j){
      element = tLookup[face.ti[j]];
      for(k=0; k<element.length; ++k){
        this.texCoords.push(element[k]);
      }
    }

    // normals
    for(j=0; j<face.ni.length; ++j){
      element = nLookup[face.ni[j]];
      for(k=0; k<element.length; ++k){
        this.normals.push(element[k]);
      }
    }
  }

  console.log('vLookup: ' + vLookup.length);
  console.log('tLookup: ' + tLookup.length);
  console.log('nLookup: ' + nLookup.length);
  console.log('vertices: ' + this.vertices.length);
  console.log('texCoords: ' + this.texCoords.length);
  console.log('normals: ' + this.normals.length);
  console.log('faces: ' + faces.length);
  console.log('indices: ' + this.indices.length);

  console.timeEnd('split');
  this.callback();
}