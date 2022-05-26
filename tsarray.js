// timestamp array

function TSArray() {
    this.items = [];
}

TSArray.prototype = {
    add: function(obj, ts=Date.now()) {
        this.items.push({ts, obj})
    },
    prune: function(duration, now=Date.now()) {
        this.items = this.items.filter(i => now - i.ts <= duration);
    },
    forEachRecent: function(duration, cb, now=Date.now()) {
        this.items.forEach(i => (now - i.ts <= duration) ? cb(i.obj) : null);
    }
}

export default TSArray; 