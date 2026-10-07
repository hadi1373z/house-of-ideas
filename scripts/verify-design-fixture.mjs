// A fully embedded indexed triangle; no network resources or test user data.
export function triangleGlb(change=()=>{},changeBinary=()=>{},extraBinaryLength=0){
 const binary=Buffer.alloc(44+extraBinaryLength),values=[-.5,0,0,.5,0,0,0,1,0];values.forEach((value,index)=>binary.writeFloatLE(value,index*4));
 binary.writeUInt16LE(0,36);binary.writeUInt16LE(1,38);binary.writeUInt16LE(2,40);
 const json={asset:{version:'2.0',generator:'House of Ideas test fixture'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.2,.6,.9,1],metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:42}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:6}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-.5,0,0],max:[.5,1,0]},{bufferView:1,componentType:5123,count:3,type:'SCALAR'}]};
 if(extraBinaryLength)json.buffers[0].byteLength=binary.length;change(json);changeBinary(binary);
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(padded);
 const output=Buffer.alloc(12+8+padded.length+8+binary.length);output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);const at=20+padded.length;output.writeUInt32LE(binary.length,at);output.writeUInt32LE(0x004e4942,at+4);binary.copy(output,at+8);return output;
}
