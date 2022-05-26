import DeviceDetector from "https://cdn.skypack.dev/device-detector-js@2.2.10";
// Usage: testSupport({client?: string, os?: string}[])
// Client and os are regular expressions.
// See: https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/README.md for
// legal values for client and os
testSupport([
    { client: 'Chrome' },
]);
function testSupport(supportedDevices) {
    const deviceDetector = new DeviceDetector();
    const detectedDevice = deviceDetector.parse(navigator.userAgent);
    let isSupported = false;
    for (const device of supportedDevices) {
        if (device.client !== undefined) {
            const re = new RegExp(`^${device.client}$`);
            if (!re.test(detectedDevice.client.name)) {
                continue;
            }
        }
        if (device.os !== undefined) {
            const re = new RegExp(`^${device.os}$`);
            if (!re.test(detectedDevice.os.name)) {
                continue;
            }
        }
        isSupported = true;
        break;
    }
    if (!isSupported) {
        alert(`This demo, running on ${detectedDevice.client.name}/${detectedDevice.os.name}, ` +
            `is not well supported at this time, expect some flakiness while we improve our code.`);
    }
}

function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    const body = window.document.body;
    body.appendChild(tempLink);

    tempLink.href = objectUrl;
    tempLink.setAttribute('download', filename);
    tempLink.click();

    setTimeout(() => {
        body.removeChild(tempLink);
        URL.revokeObjectURL(objectUrl);
    }, 1000);
}

//-----------------------------------------------------------------------------------------

import Vector from "./vector.js";
import Gesture from "./gesture.js";

const controls = window;
const LandmarkGrid = window.LandmarkGrid;
const drawingUtils = window;
const mpPose = window;
const options = {
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${mpPose.VERSION}/${file}`;
    }
};
// Our input frames will come from here.
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
const canvasCtx = canvasElement.getContext('2d');
// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
const fpsControl = new controls.FPS();
// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
    spinner.style.display = 'none';
};


function VecFromLM(lm) {
    return new Vector(lm.x, lm.y, lm.z);
}

const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
const grid = new LandmarkGrid(landmarkContainer, {
    connectionColor: 0xCCCCCC,
    definedColors: [{ name: 'LEFT', value: 0xffa500 }, { name: 'RIGHT', value: 0x00ffff }],
    range: 2,
    fitToGrid: true,
    labelSuffix: 'm',
    landmarkSize: 2,
    numCellsPerAxis: 4,
    showHidden: false,
    centered: true,
});

let recording = false;
let currentRecording = [];
let currentRecordingStart = 0;


let gestureLeft = new Gesture('left');
let gestureRight = new Gesture('right');

let activeEffect = 'mask';
function onResults(results) {
    // Hide the spinner.
    document.body.classList.add('loaded');
    // Update the frame rate.
    fpsControl.tick();
    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.segmentationMask) {
        canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
        // Only overwrite existing pixels.
        if (activeEffect === 'mask' || activeEffect === 'both') {
            canvasCtx.globalCompositeOperation = 'source-in';
            // This can be a color or a texture or whatever...
            canvasCtx.fillStyle = '#00FF007F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        else {
            canvasCtx.globalCompositeOperation = 'source-out';
            canvasCtx.fillStyle = '#0000FF7F';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }
        // Only overwrite missing pixels.
        canvasCtx.globalCompositeOperation = 'destination-atop';
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.globalCompositeOperation = 'source-over';
    }
    else {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }
    if (results.poseLandmarks) {
        drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS, { visibilityMin: 0.65, color: 'white' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_LEFT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_RIGHT)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)' });
        drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_NEUTRAL)
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'white' });
        
        
        if (results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].visibility > 0.5 && 
            results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].visibility > 0.5) {
        
            let rs = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER]);
            let ls = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.LEFT_SHOULDER]);
            let center = rs.add(ls).divide(2.0);

            if (results.poseLandmarks[POSE_LANDMARKS.LEFT_INDEX].visibility > 0.5) {
                let left = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.LEFT_INDEX]).subtract(center);
                gestureLeft.track(left);
            } else {
                gestureLeft.reset();
            }

            if (results.poseLandmarks[POSE_LANDMARKS.RIGHT_INDEX].visibility > 0.5) {
                let right = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.RIGHT_INDEX]).subtract(center);
                gestureRight.track(right);
            } else {
                gestureRight.reset();
            }
        } else {
            gestureLeft.reset();
            gestureRight.reset();
        }
    

        /*

        for each hand
            calculate average velocity
            if avg velocity > start thresh
                "touch start"
            if avg velocity < end threshold and started
                "touch end"
            if ended and direction isn't down and magnitude is over threshold then send event to unreal
        */
        if (recording) {
            currentRecording.push({
                landmarks: results.poseLandmarks,
                timestamp: Date.now() - currentRecordingStart
            });
        }

        let leftHand = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.LEFT_INDEX]);
        let rightHand = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.RIGHT_INDEX]);
        let nose = VecFromLM(results.poseLandmarks[POSE_LANDMARKS.NOSE]);

        drawingUtils.drawLandmarks(canvasCtx, Object.values([POSE_LANDMARKS.LEFT_INDEX, POSE_LANDMARKS.RIGHT_INDEX])
            .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'red', fillColor: 'yellow' });
    }
    canvasCtx.restore();
    if (results.poseWorldLandmarks) {
        grid.updateLandmarks(results.poseWorldLandmarks, mpPose.POSE_CONNECTIONS, [
            { list: Object.values(mpPose.POSE_LANDMARKS_LEFT), color: 'LEFT' },
            { list: Object.values(mpPose.POSE_LANDMARKS_RIGHT), color: 'RIGHT' },
        ]);
    }
    else {
        grid.updateLandmarks([]);
    }
}
const pose = new mpPose.Pose(options);
pose.onResults(onResults);
// Present a control panel through which the user can manipulate the solution
// options.
new controls
    .ControlPanel(controlsElement, {
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    effect: 'background',
    recording: false,
})
    .add([
    new controls.StaticText({ title: 'Dezyn gesture detector' }),
    fpsControl,
    // new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new controls.SourcePicker({
        onSourceChanged: () => {
            // Resets because this model gives better results when reset between
            // source changes.
            pose.reset();
        },
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height;
            await pose.send({ image: input });
        },
    }),
    new controls.Slider({
        title: 'Model Complexity',
        field: 'modelComplexity',
        discrete: ['Lite', 'Full', 'Heavy'],
    }),
    new controls.Toggle({ title: 'Smooth Landmarks', field: 'smoothLandmarks', readonly:true }),
    // new controls.Toggle({ title: 'Enable Segmentation', field: 'enableSegmentation' }),
    // new controls.Toggle({ title: 'Smooth Segmentation', field: 'smoothSegmentation' }),
    new controls.Slider({
        title: 'Min Detection Confidence',
        field: 'minDetectionConfidence',
        range: [0, 1],
        step: 0.01
    }),
    new controls.Slider({
        title: 'Min Tracking Confidence',
        field: 'minTrackingConfidence',
        range: [0, 1],
        step: 0.01
    }),
    //new controls.StaticText({title: 'Unreal connected: NOPE', background:'red'}),
    // new controls.Slider({
    //     title: 'Effect',
    //     field: 'effect',
    //     discrete: { 'background': 'Background', 'mask': 'Foreground' },
    // }),
    new controls.Toggle({ title: 'Recording', field: 'recording' }),
])
    .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    activeEffect = x['effect'];
    pose.setOptions(options);
    
    if (!recording && options.recording) {
        currentRecordingStart = Date.now();
    }
    if (!options.recording && currentRecording.length > 0) {
        console.log("Saving recording number of frames: ", currentRecording.length);
        console.log("Data length: ", JSON.stringify(currentRecording).length);
        let filename = prompt("Recording name: ", "recording.json");
        downloadBlob(new Blob([JSON.stringify(currentRecording)], {type:"application/json"}), filename);
        currentRecording = [];
    }
    recording = options.recording;
});