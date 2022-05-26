import Vector from "./vector.js";
import TSArray from "./tsarray.js";

function Gesture(name) {
    this.name = name;
    this.positions = new TSArray()
    this.onGestureCb = () => null;
    this.reset();
}

Gesture.prototype = {
    track: function(p, now=Date.now()) {
        if (this.last == 0) {
            this.last = p;
        } else {

            // ignore z movement for now
            p.z = 0;

            // ignore the rebound gesture
            if (now - this.lastDetectedTime < 750) {
                return;
            }

            this.positions.add(p.subtract(this.last));
            this.last = p;
            this.positions.prune(500);

            let sum = new Vector(0.0,0.0,0.0);
            let cnt = 0;
            this.positions.forEachRecent(400, p => {sum=sum.add(p); cnt++;});
            const avg = sum.divide(cnt);
            const currentMovement = avg.length();


            if (currentMovement > 0.015) {
                if (this.startTime == 0) {
                    this.startTime = now;
                }
                if (now - this.startTime > 300 && !this.started) {
                    this.started = true;
                    this.maxMovement = currentMovement;
                    this.currentGesture = avg;
                }
                if (this.started) {
                    if (currentMovement > this.maxMovement) {
                        this.maxMovement = currentMovement;
                        this.currentGesture = avg;
                    }
                }
            } else {
                if (this.started) {
                    console.log(this.name, "DETECTED", this.currentGesture);
                    this.lastDetectedTime = now;
                }
                this.startTime = 0;
                this.started = false;
            }
        }
    },
    reset: function() {        
        this.last = 0;
        this.startTime = 0;
        this.started = false;
        this.positions.items = [];
        this.lastDetectedTime = 0;
        this.maxMovement = 0;
        this.currentGesture = 0;
    },
    onGesture: function(cb) {
        this.onGestureCb = cb;
    },
}

export default Gesture;