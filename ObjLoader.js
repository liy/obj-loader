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

ObjFace.prototype.calculateNormal = function(vLookup, vertexNormals, smoothNormal){
  var m = vec3.fromValues(
    vLookup[this.vi[1]*3]   - vLookup[this.vi[0]*3],
    vLookup[this.vi[1]*3+1] - vLookup[this.vi[0]*3+1],
    vLookup[this.vi[1]*3+2] - vLookup[this.vi[0]*3+2]);
  var n = vec3.fromValues(
    vLookup[this.vi[2]*3]   - vLookup[this.vi[0]*3],
    vLookup[this.vi[2]*3+1] - vLookup[this.vi[0]*3+1],
    vLookup[this.vi[2]*3+2] - vLookup[this.vi[0]*3+2]);
  vec3.cross(this.normal, m, n);
  vec3.normalize(this.normal, this.normal);

  if(smoothNormal){
    // accumulate the normals for every vertices on the face.
    for(var i=0; i<this.vi.length; ++i){
      var vertexNormal = vertexNormals[this.vi[i]];
      if(vertexNormal)
        vec3.add(vertexNormals[this.vi[i]], vertexNormal, this.normal);
      else
        vertexNormals[this.vi[i]] = vec3.clone(this.normal);
    }
  }
}







function ObjLoader(path, callback){
  this.path = path;
  this.callback = callback;

  this.smoothNormal = false;

  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  xhr.onload = bind(this, this.onload);
  xhr.send();
}
var p = ObjLoader.prototype;

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

  // if face definition includes '/', it means a index re-arrangement should be performed. Since
  // this format of .obj file might not use same index sequence for vertex, texture and normals.
  var doIndexRearrangement = true;

  // every time a face normal is generated, the normal will be added against corresponding vertex's _vertexNormals.
  // When all the face normals generation completed, all the vertices's _vertexNormals will be normalized
  vertexNormals = new Array();

  len = lines.length;
  for(var i=0; i<len; ++i){
    var line = lines[i];

    // empty line and comments
    if(line.trim() == '' || line.charAt(0) == '#')
      continue;

    switch(line.substr(0, 2)){
      case 'v ':
        tokens = line.substr(1).trim().split(' ');
        for(j=0; j<3; ++j){
          vLookup.push(Number(tokens[j]));
        }
        break;
      case 'vt':
        hasTexCoords = true;

        tokens = line.substr(2).trim().split(' ');
        this.texCoordComponentSize = tokens.length;
        for(j=0; j<this.texCoordComponentSize; ++j){
          tLookup.push(Number(tokens[j]));
        }
        break;
      case 'vn':
        tokens = line.substr(2).trim().split(' ');
        for(j=0; j<3; ++j){
          nLookup.push(Number(tokens[j]));
        }
        break;
      case 'f ':
        // if faces only contains vertex index, no need to perform index re-arrangement process.
        if(doIndexRearrangement && line.indexOf('/') === -1)
          doIndexRearrangement = false;

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

  // face's indices correction, make sure they are positive and 0 based
  len = faces.length;
  for(i=0; i<len; ++i){
    faces[i].correction(vLookup.length/3, tLookup.length/this.texCoordComponentSize, nLookup.length/3);
  }

  // whether the obj file has normal definition
  var hasNormals = (nLookup.length !== 0);
  // TODO: whether to do smooth normal calculation
  if(!hasNormals){
    // calculate face normals
    for(i=0; i<len; ++i){
      faces[i].calculateNormal(vLookup, vertexNormals, this.smoothNormal);
    }
    // normalize all the normals
    for(i=0; i<vertexNormals.length; ++i){
      if(vertexNormals[i])
        vec3.normalize(vertexNormals[i], vertexNormals[i]);
    }
  }

  if(doIndexRearrangement){
    var index = 0;
    for(i=0; i<len; ++i){
      var face = faces[i];
      for(j=0; j<face.vi.length; ++j){
          this.vertices.push(vLookup[ face.vi[j]*3 ]);
          this.vertices.push(vLookup[ face.vi[j]*3+1 ]);
          this.vertices.push(vLookup[ face.vi[j]*3+2 ]);

          if(!hasNormals && !this.smoothNormal){
            this.normals.push(face.normal[0]);
            this.normals.push(face.normal[1]);
            this.normals.push(face.normal[2]);
          }

          this.indices.push(index++);
      }

      for(j=0; j<face.ti.length; ++j){
        this.texCoords.push(tLookup[ face.ti[j]*this.texCoordComponentSize ]);
        this.texCoords.push(tLookup[ face.ti[j]*this.texCoordComponentSize+1 ]);
        if(this.texCoordComponentSize === 3)
          this.texCoords.push(tLookup[ face.ti[j]*this.texCoordComponentSize+2 ]);
      }

      for(j=0; j<face.ni.length; ++j){
        this.normals.push(nLookup[ face.ni[j]*3 ]);
        this.normals.push(nLookup[ face.ni[j]*3+1 ]);
        this.normals.push(nLookup[ face.ni[j]*3+2 ]);
      }

      // use calculated smoothed normals
      if(!hasNormals && this.smoothNormal){
        for(j=0; j<face.vi.length; ++j){
          this.normals.push(vertexNormals[ face.vi[j] ][0]);
          this.normals.push(vertexNormals[ face.vi[j] ][1]);
          this.normals.push(vertexNormals[ face.vi[j] ][2]);
        }
      }
    }
  }
  // no index re-arrangement needed
  else{
    this.vertices = vLookup;
    this.texCoords = tLookup;
    this.normals = nLookup;

    for(i=0; i<len; ++i){
      var face = faces[i];
      for(j=0; j<face.vi.length; ++j){
        if(this.smoothNormal){
          if(!hasNormals){
            this.normals[ face.vi[j]*3 ] = vertexNormals[ face.vi[j] ][0];
            this.normals[ face.vi[j]*3+1 ] = vertexNormals[ face.vi[j] ][1];
            this.normals[ face.vi[j]*3+2 ] = vertexNormals[ face.vi[j] ][2];
          }
        }
        else{
          this.normals[ face.vi[j]*3 ] = face.normal[0];
            this.normals[ face.vi[j]*3+1 ] = face.normal[1];
            this.normals[ face.vi[j]*3+2 ] = face.normal[2];
        }

        // just use face definition's vertex index as OpenGL element index.
        this.indices.push(face.vi[j]);
      }
    }
  }


  console.log('vLookup: ' + vLookup.length);
  console.log('vertices: ' + this.vertices.length);
  console.log('normals: ' + this.normals.length);
  console.log('faces: ' + faces.length + ' *3*3: ' + faces.length*3*3);
  console.log('indices: ' + this.indices.length + ' *3: ' + this.indices.length*3);


  console.timeEnd('split');
  this.callback();
}