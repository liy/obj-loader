function ObjFace(){
  this.vi = new Array();
  this.ti = new Array();
  this.ni = new Array();

  this.normal = vec3.create();
}

/**
 * Add index information to the face
 * @param {[type]} vi [description]
 * @param {[type]} ti [description]
 * @param {[type]} ni [description]
 */
ObjFace.prototype.addIndices = function(vi, ti, ni){
  this.vi.push(vi);

  if(!isNaN(ti)){
    this.ti.push(ti);
  }

  if(!isNaN(ni)){
    this.ni.push(ni);
  }
}

/**
 * Making sure the index are positive and 0 based
 * @param  {[type]} vLookupSize [description]
 * @param  {[type]} tLookupSize [description]
 * @param  {[type]} nLookupSize [description]
 */
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
  // cross product and normalization to get the face's normal
  var m = vec3.sub(vec3.create(), vLookup[this.vi[1]], vLookup[this.vi[0]]);
  var n = vec3.sub(vec3.create(), vLookup[this.vi[2]], vLookup[this.vi[0]]);
  vec3.cross(this.normal, m, n);
  vec3.normalize(this.normal, this.normal);
}

ObjFace.prototype.calculateSmoothNormal = function(vLookup, nLookup){
  // generate the face normal
  this.calculateFaceNormal(vLookup)

  // Smooth normal only happens on the vertex shared by faces.
  // This means that one vertex has only ONE normal, therefore, the index of normal
  // can be set as the same as the index of vertex.
  this.ni = this.vi;
  // By scanning all the normal indices of this face, accumulate the normal for every vertex.
  for(var i=0; i<this.ni.length; ++i){
    // Add the face's normal to the face's vertex normal, so we can eventually normalize it to
    // get the smoothed normal of the vertex.
    //
    // Note that we are directly updating nLookup 'library' data.
    var vertexNormal = nLookup[this.ni[i]];
    if(vertexNormal)
      vec3.add(vertexNormal, vertexNormal, this.normal);
    else
      nLookup[this.ni[i]] = vec3.clone(this.normal);
  }
}



function ObjLoader(flatShading, useIndex){
  if(flatShading)
    this.flatShading = flatShading;
  else
    this.flatShading = false;

  if(useIndex){
    this.useIndex = useIndex;
    if(this.flatShading && this.useIndex){
      this.useIndex = false;
      console.warn('Cannot use flat shading and index element at the same time. Index usage will be turned off');
    }
  }
  else
    this.useIndex = false;

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

  // vertex, texture coordinates, normals and faces. Contains flat coordinate values, float(Number).
  // Will be directly used by OpenGL to setup data buffer.
  this.vertices = new Array();
  this.texCoords = new Array();
  this.normals = new Array();

  // index array. Points to the library data.
  // Note that only in smooth shading mode, the index element could be enabled.
  // Because in smooth shading mode, one vertex only have exact ONE normal; however in flat shading mode,
  // a vertex shared by different faces will need multiple normals, which cannot be expressed by single index.
  // e.g.,
  // a vertex 'V' in vertex array is expressed by index location: 'I'.
  // In the normal array there is an entry 'N' pointed by 'I'. In flat shading mode if the index is shared by multiple faces, normal should be different
  // But you cannot locate the different normals use the same index 'I'.
  this.indices = new Array();

  // Contains Flat32Array data.
  // Consider the vertex, texture coordinate and normal data definitions in obj files as a 'library'.
  // In other words, these look up array contains actual data. The face definition only contains index which
  // reference to the look up array, the actual data.
  //
  // In some cases, for example, the normals might be missing in the obj file. We just need to generate(use face's normal, cross product) correct
  // normal for every vertex, and then make sure the face's ni(normal index) is pointed to the corresponding generate normal.
  var vLookup = new Array();
  var tLookup = new Array();
  var nLookup = new Array();

  // Keeping track the face definition in the obj file.
  // Only 3 vertex(3 texture coordinate indices, 3 normal indices) indices stored, that is a triangle.
  // It contains face's vertex, texture coordinate and normal **index** points to the
  // corresponding 'library': XLookup array.
  var faces = new Array();

  // texture coordinate component size. Some obj file has different component size
  this.texCoordComponentSize = 2;

  // temp element for vertex, texture coordinates and normal.
  var element;

  len = lines.length;
  for(var i=0; i<len; ++i){
    var line = lines[i];

    // ignore empty line and comments
    if(line.trim() == '' || line.charAt(0) == '#')
      continue;

    // extract the data from obj file
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
        // We need triangle face, it is easier to handle.
        // If obj file has 4 vertices, break them into 2 triangle faces.
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

  // obj file's index can be negative and they are 1 based.
  // Correct the face index definition, making sure they are positive and 0 based.
  len = faces.length;
  for(i=0; i<len; ++i){
    faces[i].correction(vLookup.length, tLookup.length, nLookup.length);
  }

  // if no normals definition in obj file. Auto generate them using face's normal(smooth process can be also performed)
  if(nLookup.length === 0){
    if(this.flatShading){
      // flat shading. Using face's normal for every corresponding vertex.
      // First we generate face normal for every faces, and push them into the 'library', nLookup.
      // Then scan face's ni(normal index array), points them to the current normal data from nLookup.
      for(i=0; i<len; ++i){
        var face = faces[i];
        face.calculateFaceNormal(vLookup);
        nLookup.push(face.normal);

        // Make the face's normal index points to the current face normal in the nLookup library array
        for(j=0; j<face.vi.length; ++j){
          face.ni[j] = nLookup.length-1;
        }
      }
    }
    else{
      // We update the 'library' nLookup by accumulating the adjacent faces' normal.
      // The face's ni is empty because no definition is given in obj file, also needs to be updated.(Detail refers to the method)
      for(i=0; i<len; ++i){
        faces[i].calculateSmoothNormal(vLookup, nLookup);
      }
      // Once all the faces' normal are generated, normalize them to get the smooth averaged normal
      for(i=0; i<nLookup.length; ++i){
        // FIXME: some nLookup entry might be undefined, I guess it is the obj data file's bug
        if(nLookup[i])
          vec3.normalize(nLookup[i], nLookup[i]);
      }
    }
  }

  if(this.useIndex){
    for(i=0; i<len; ++i){
      var face = faces[i];

      for(j=0; j<face.vi.length; ++j){
        element = vLookup[face.vi[j]];
        this.vertices[face.vi[j]*3] = element[0];
        this.vertices[face.vi[j]*3+1] = element[1];
        this.vertices[face.vi[j]*3+2] = element[2];

        this.indices.push(face.vi[j]);
      }

      for(j=0; j<face.ti.length; ++j){
        element = tLookup[face.ti[j]];
        this.texCoords[face.vi[j]*3] = element[0];
        this.texCoords[face.vi[j]*3+1] = element[1];
        if(face.ti[j].length === 3)
          this.texCoords[face.vi[j]*3+2] = element[2];
      }

      for(j=0; j<face.ni.length; ++j){
        element = nLookup[face.ni[j]];
        this.normals[face.vi[j]*3] = element[0];
        this.normals[face.vi[j]*3+1] = element[1];
        this.normals[face.vi[j]*3+2] = element[2];
      }
    }
  }
  else{
    // generate the vertices, texture coordinates and normals data properly for OpenGL.
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