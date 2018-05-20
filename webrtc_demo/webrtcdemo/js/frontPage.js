'use strict';

/*
var gRemoteUserObjArray = new Array();
var remoteUserObj = new Object();
remoteUserObj.name = '123';
remoteUserObj.stream = null;
remoteUserObj.peerconnection = null;
gRemoteUserObjArray.push(remoteUserObj);
remoteUserObj = new Object();
remoteUserObj.name = '234';
remoteUserObj.stream = null;
gRemoteUserObjArray.push(remoteUserObj);
remoteUserObj = new Object();
remoteUserObj.name = '345';
remoteUserObj.stream = null;
gRemoteUserObjArray.push(remoteUserObj);

var obj, i;
for(i=0; i<gRemoteUserObjArray.length; i++)
{
	obj = gRemoteUserObjArray[i];
	trace("name:"+obj.name);
}

gRemoteUserObjArray.splice(1,1);
for(i=0; i<gRemoteUserObjArray.length; i++)
{
	obj = gRemoteUserObjArray[i];
	trace("name:"+obj.name);
}
*/
trace('current ip:'+window.location.host.split(':'));
trace('current port:'+window.location.port);
//var serverIp = '10.27.105.60';
//var serverIp = '218.106.117.18';
var serverIp = window.location.host.split(':')[0];
var serverPort = '40444';
var turnPort = '49786';

var gRemoteUserNameText = document.getElementById('remoteNameText');
var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var hangupButton = document.getElementById('hangupButton');
var toastText = document.getElementById('toastText');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.onclick = start_listen;
callButton.onclick = callRemoteClient;
hangupButton.onclick = hangup;

var gLocalUserName = '0';
//var gRemoteUserName='';
//var gRemoteUserName= new Array();
//var gRemoteUserNum = 0;


//name/stream/peerconnection
var gRemoteUserArray = new Array();

var gIsRegisterFlag = false;
var isStarted = false;

var gLocalStream;
var gRemoteStream;

var gPeerConnection = new Array();;

var gLocalVideo = document.querySelector('#localVideo');

var gRemoteVideoTitle = new Array();
gRemoteVideoTitle[0] = document.getElementById('videoTitle0');
gRemoteVideoTitle[1] = document.getElementById('videoTitle1');
gRemoteVideoTitle[2] = document.getElementById('videoTitle2');
gRemoteVideoTitle[3] = document.getElementById('videoTitle3');
gRemoteVideoTitle[4] = document.getElementById('videoTitle4');

var gRemoteVideoView = new Array();
gRemoteVideoView[0] = document.querySelector('#remoteVideo0');
gRemoteVideoView[1] = document.querySelector('#remoteVideo1');
gRemoteVideoView[2] = document.querySelector('#remoteVideo2');
gRemoteVideoView[3] = document.querySelector('#remoteVideo3');
gRemoteVideoView[4] = document.querySelector('#remoteVideo4');

var iceServer = {
  'iceServers': [{
    //url: 'turn:10.27.105.105:3478',
	url: 'turn:'+serverIp+':'+turnPort,
	username: 'media1',
	credential: 'mediatest1'
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};


console.log('gLocalUserName:', gLocalUserName);
var socket = io.connect(serverIp+':'+serverPort);
if (!socket)
{
	asert("connect to "+serverIp+serverPort+" failed");
	exit;
}

socket.on('registerOk', function(userName, id) {
  console.log('register ok, userName:'+userName+' id:' + id);
  document.getElementById('myIdText').innerHTML = userName;
  gLocalUserName = userName;
  startButton.disabled = true;
  callButton.disabled = false;
  hangupButton.disabled = false;
  gIsRegisterFlag = true;
});

socket.on('newClient', function(onLineUserName) {
  console.log('newClient:' + onLineUserName + ' coming');
  //document.getElementById('clientText').innerHTML+='\r\n'+onLineUserName;
  socket.emit('getAllClients', gLocalUserName);
  gRemoteUserNameText.value = onLineUserName;
});

socket.on('returnAllClients', function(clientList) {
	trace('clientList:'+clientList);
  document.getElementById('clientText').innerHTML = clientList;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('isOnline', function (remoteName, ret){
  trace('check remeoteName:'+remoteName + ' is online:'+ret);
  if (ret===1)
  {
	  if (check_remote_user_exist(remoteName) >= 0)
	  {
		  toastText.innerHTML = "["+remoteName+"]已连接，请输入其它在线用户ID.....";
		  return;
	  }
	  sendMessage(remoteName, {
		  type: 'requestConnect',
		  label: gLocalUserName
		});
		
	  toastText.innerHTML = "正在请求连接["+remoteName+"].....";
  }
  else
  {
	  toastText.innerHTML = "["+remoteName+"]不在线，请输入在线用户ID.....";
  }
});

////////////////////////////////////////////////
function sendMessage(remoteUserName, message) {
  console.log('Client sending message: '+message+' to '+ remoteUserName);
  socket.emit('message', gLocalUserName, remoteUserName, message);
}


// This client receives a message
socket.on('message', function(remoteName, message) {
  console.log('Client received message:'+message);
  var id = add_remote_user(remoteName);
  if (message.type === 'offer') {
    var peerConnection = create_peerconnection(remoteName);
	if (peerConnection==null)
	{
		trace("create peerConnection error");
		asert("create peerConnection error");
	}
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
	gRemoteUserArray[id].peerConnection = peerConnection;
    doAnswer(remoteName, peerConnection);	
	//callButton.disabled = true;
	//hangupButton.disabled = false;
  } else if (message.type === 'answer') {
    gRemoteUserArray[id].peerConnection.setRemoteDescription(new RTCSessionDescription(message));
	//callButton.disabled = true;
	//hangupButton.disabled = false;
  } else if (message.type === 'candidate') {
	  trace("recv candidata:"+message.candidate);
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    gRemoteUserArray[id].peerConnection.addIceCandidate(candidate);
  } else if (message.type === 'requestConnect')
  {
	  trace('the remote['+remoteName+'] request connection');
	  toastText.innerHTML = "对方["+remoteName+"]正在请求新的连接......";
	  if (gRemoteUserArray.length < 5)
	  {
		  sendMessage(remoteName, {
			  type: 'requestConnectOk',
			  label: gLocalUserName
			});
		  toastText.innerHTML = "同意["+remoteName+"]的连接请求.....";
	  }
	  else
	  {
		  sendMessage(remoteName, {
			  type: 'connectOnFull',
			  label: gLocalUserName
			});
		  toastText.innerHTML = "当前连接已满.....";
	  }
	  
  }else if (message.type === 'requestConnectOk')
  {
	  trace("正在与对方["+remoteName+"]建立数据通道......");
	  toastText.innerHTML = "对方["+remoteName+"]已确认，数据通道建立中......";
	  doBuildConnection(remoteName);
  }else if (message.type === 'connectOnFull')
  {
	  trace("对方["+remoteName+"]连接已满，请输入在线用户ID...");
	  handleRemoteHangup(remoteName);
	  toastText.innerHTML = "对方["+remoteName+"]连接已满，请输入其它在线用户ID...";
  }  
});
socket.on('hungup', function(remoteName) {
  console.log('remoteName:'+remoteName+' say hungup');
  trace("hungup the remote connection");
  handleRemoteHangup(remoteName);
});
socket.on('bye', function(remoteName) {
  console.log('remoteName:'+remoteName+' say bye');
  socket.emit('getAllClients', gLocalUserName);
  handleRemoteHangup(remoteName);
});

////////////////////////////////////////////////////
/*
var supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
trace('supportcons:',supportedConstraints);

for (let constraint in supportedConstraints) {
  if (supportedConstraints.hasOwnProperty(constraint)) {    
	trace('supportcons:'+constraint);
  }
}
*/
navigator.mediaDevices.getUserMedia({
  //audio: true,
  video: true,
  audio:{
  echoCancellation:true,
  noiseSuppression:true,
  autoGainControl:true
  }
})
.then(gotStream)
.catch(function(e) {
  trace('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  gLocalVideo.src = window.URL.createObjectURL(stream);
  gLocalVideo.muted=true;
  gLocalStream = stream;
  var audioTrack;
  audioTrack=gLocalStream.getAudioTracks()[0];
  var settings = audioTrack.getSettings();
  settings.echoCancellation = true;
  settings.noiseSuppression = true;
  settings.autoGainControl = true;
}
function start_listen() {
	socket.emit('register', gLocalUserName);
	console.log('Attempted to register', gLocalUserName);
	trace("local name:"+gLocalUserName);
}
start_listen();
function realloc_video()
{
	var obj, i;
	for(i=0; i<gRemoteUserArray.length; i++)
	{
		gRemoteVideoTitle[i].innerHTML = gRemoteUserArray[i].name;
		gRemoteVideoView[i].src = window.URL.createObjectURL(gRemoteUserArray[i].stream);
		trace("realloc view set:"+i);
	}
	
	for(i=gRemoteUserArray.length; i<5; i++)
	{
		gRemoteVideoTitle[i].innerHTML = "";
		gRemoteVideoView[i].src = "";
		trace("realloc view clear:"+i);
	}
}

function create_peerconnection(remoteName) {
    console.log('>>>>>> creating peer connection');
	var peerConnection = null;
	try {
		peerConnection = new RTCPeerConnection(iceServer);
		peerConnection.onicecandidate = function(evt){
			  console.log('icecandidate event: '+ event);
			  if (event.candidate) {
				sendMessage(remoteName, {
				  type: 'candidate',
				  label: event.candidate.sdpMLineIndex,
				  id: event.candidate.sdpMid,
				  candidate: event.candidate.candidate
				});
			  } else {
				console.log('End of candidates.');
			  }
			};
		peerConnection.onaddstream = function (event) {
			var id = check_remote_user_exist(remoteName);
			  console.log('Remote stream added.for:'+gRemoteUserArray[id].name);
			  gRemoteUserArray[id].stream = event.stream;
			  realloc_video();
			};
		peerConnection.onremovestream = handlegRemoteStreamRemoved;
		console.log('Created RTCPeerConnnection');
	} catch (e) {
		console.log('Failed to create PeerConnection, exception: ' + e.message);
		alert('Cannot create RTCPeerConnection object.');
		return null;
	}
    peerConnection.addStream(gLocalStream);
	return peerConnection;
}

function callRemoteClient() {
	if (!gIsRegisterFlag)
	{
		toastText.innerHTML = "Has not register, must start to register...";
		return;
	}
    var remoteName = gRemoteUserNameText.value;
	trace('remoteName :'+ gRemoteUserNameText.value);
	if (remoteName==='')
	{
		trace("please input remote ID.....");
		toastText.innerHTML = "please input remote ID.....";
		return;
	}
	trace('checking online status of '+remoteName);
	socket.emit('isOnline', remoteName);
}

window.onbeforeunload = function() {
  trace("send bye to others");
  var obj, i;
  for (i=0; i<gRemoteUserArray.length; i++)
  {
	  obj  = gRemoteUserArray[i];
	  socket.emit('bye', gLocalUserName, obj.name);
  }
  
};

function handleIceCandidate(event) {
  console.log('icecandidate event: '+ event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handlegRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  gRemoteVideoView[gRemoteUserNum-1].src = window.URL.createObjectURL(event.stream);
  gRemoteStream = event.stream;
}

function handlegRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: '+event);
}

function doBuildConnection(remoteName) {
    var peerConnection = create_peerconnection(remoteName);
	if (peerConnection==null)
	{
		trace("create peerConnection error");
		asert("create peerConnection error");
	}
	
	var id = add_remote_user(remoteName);
	gRemoteUserArray[id].peerConnection = peerConnection;
	trace('Sending offer to peer:'+remoteName);
	peerConnection.createOffer(function (sessionDescription) {
	  // Set Opus as the preferred codec in SDP if Opus is present.
	  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
	  peerConnection.setLocalDescription(sessionDescription);
	  trace('Offer setLocalDescription and send to remote'+sessionDescription);
	  sendMessage(remoteName, sessionDescription);	  	  
	}, 
	function (event) {
	  trace('createOffer() error: '+event);
	  toastText.innerHTML = 'createOffer() error: '+event;
	  socket.emit('hungup', gLocalUserName, remoteName);
	  handleRemoteHangup(remoteName);
	});
}

function doAnswer(remoteName, peerConnection) {
  trace('Sending answer to peer:'+remoteName);
  peerConnection.createAnswer().then(function (sessionDescription) {
	  // Set Opus as the preferred codec in SDP if Opus is present.
	  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
	  peerConnection.setLocalDescription(sessionDescription);
	  trace('Answer setLocalDescription and send to remote'+sessionDescription);
	  sendMessage(remoteName, sessionDescription);
	},
    function (error) {
		trace('createAnswer() failed: ' + error.toString());
		toastText.innerHTML = 'createAnswer() failed: ' + error.toString();
		socket.emit('hungup', gLocalUserName, remoteName);
		handleRemoteHangup(remoteName);
	}
  );
}


function hangup() {
	var remoteName = gRemoteUserNameText.value;
	if (remoteName==='')
	{
		trace("please input remote ID.....");
		toastText.innerHTML = "please input remote ID.....";
		return;
	}
	
  var id = check_remote_user_exist(remoteName);
  if (id < 0)
  {
	  trace("handleRemoteHangup not exist:"+remoteName);
	  return;
  }
  
  trace('hangup:'+remoteName);
  stop(id);
  socket.emit('hungup', gLocalUserName, remoteName);
  remove_remote_user(remoteName);
  dump_remote_user();
  realloc_video();
}

function handleRemoteHangup(remoteName) {
  var id = check_remote_user_exist(remoteName);
  if (id < 0)
  {
	  trace("handleRemoteHangup not exist:"+remoteName);
	  return;
  }
  
  trace('handleRemoteHangup:');
  stop(id);  
  remove_remote_user(remoteName);
  dump_remote_user();
  realloc_video();
}

function stop(id) {
	console.log("stop peerConnection:"+id);
	//gRemoteUserArray[id].stream.getTracks().forEach(function(track) {
    //track.stop();
  //});
  gRemoteUserArray[id].peerConnection.close();
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}

function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
	
  }
}


function check_remote_user_exist(remoteName)
{
	var obj, i;
	for(i=0; i<gRemoteUserArray.length; i++)
	{
		obj = gRemoteUserArray[i];
		//trace("name:"+obj.name);
		if (remoteName == obj.name)
		{
			trace("find remote user:"+remoteName+" exist["+i+"]");
			return i;
		}
	}
	
	return -1;
}

function add_remote_user(remoteName)
{
	var obj, i;
	for(i=0; i<gRemoteUserArray.length; i++)
	{
		obj = gRemoteUserArray[i];
		if (remoteName == obj.name)
		{
			trace("find remote user:"+remoteName+" has exist");
			return i;
		}
	}
	
	var remoteUserObj = new Object();
	remoteUserObj.name = remoteName;
	remoteUserObj.stream = null;
	remoteUserObj.peerconnection = null;
	gRemoteUserArray.push(remoteUserObj);
	
	var id = gRemoteUserArray.length - 1;
	trace("Add new remote user name:"+gRemoteUserArray[id].name);
	return id;
}

function remove_remote_user(remoteName)
{
	var obj, i;
	for(i=0; i<gRemoteUserArray.length; i++)
	{
		obj = gRemoteUserArray[i];
		trace("name:"+obj.name);
		if (remoteName == obj.name)
		{
			trace("find remote user:"+remoteName+" exist");
			gRemoteUserArray.splice(i,1);
			return true;
		}
	}
	
	return false;
}

function dump_remote_user()
{
	var obj, i;
	trace("remote user num:"+gRemoteUserArray.length);
	for(i=0; i<gRemoteUserArray.length; i++)
	{
		obj = gRemoteUserArray[i];
		trace("    name:"+obj.name);
	}
	
	return false;
}