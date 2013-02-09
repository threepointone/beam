var claw = require('claw'),
    Twain = require('twain'),
    each = Twain.util.each,
    isValue = Twain.util.isValue;


// requestAnimationFrame stuff.
var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || fallback;

var prev = new Date().getTime();

function fallback(fn) {
    var curr = new Date().getTime();
    var ms = Math.max(0, 16 - (curr - prev));
    setTimeout(fn, ms);
    prev = curr;
}

var doc = document,
    numUnit = /^(?:[\+\-]=)?\d+(?:\.\d+)?(%|in|cm|mm|em|ex|pt|pc|px)$/,
    unitless = {
        lineHeight: 1,
        zoom: 1,
        zIndex: 1,
        opacity: 1,
        transform: 1,
        scale: 1
    };


function camelize(s) {
    return s.replace(/-(.)/g, function(m, m1) {
        return m1.toUpperCase();
    });
}

function uppercase(p, a) {
    return a.toUpperCase();
}

function vendor(property) {
    // return the vendor prefix for a given property. should even work with firefox fudging -webkit.
    var div = document.createElement('div');
    var x = 'Khtml Moz Webkit O ms '.split(' '),
        i;
    for(i = x.length - 1; i >= 0; i--) {
        if(((x[i] ? x[i] + '-' : '') + property).replace(/\-(\w)/g, uppercase) in div.style) {
            return x[i] ? '-' + x[i].toLowerCase() + '-' : ''; // empty string, if it works without prefix
        }
    }
    return null; // not found...
}

function unit(style) {
    // extracts the unit part of the string. px, em, whatever. 
    return (/[a-z]+/.exec(style)||['px'])[0]
    // return 'px';
}

function num(style) {
    // extracts the number part of the style
    return parseFloat(style, 10);
}

// initial style is determined by the elements themselves
var getStyle = doc.defaultView && doc.defaultView.getComputedStyle ?
function(el, property) {
    property = property == 'transform' ? transform : property
    var value = null,
        computed = doc.defaultView.getComputedStyle(el, '');
    computed && (value = computed[camelize(property)]);
    return el.style[property] || value;
} : html.currentStyle ?

function(el, property) {
    property = camelize(property);

    if(property == 'opacity') {
        var val = 100;
        try {
            val = el.filters['DXImageTransform.Microsoft.Alpha'].opacity;
        } catch(e1) {
            try {
                val = el.filters('alpha').opacity;
            } catch(e2) {}
        }
        return val / 100;
    }
    var value = el.currentStyle ? el.currentStyle[property] : null
    return el.style[property] || value;
} : function(el, property) {
    return el.style[camelize(property)];
};

function setStyle(el, prop, val) {
    // "special" setStyle
    // fyi: typeof val === 'number'
    if(typeof prop !== 'string') {
        each(prop, function(v, p) {
            setStyle(el, p, v);
        });
        return;
    }

    prop = camelize(prop);
    // ok, so this the weird part 
    // because we're getting a number, we need to add unit to it 
    // we get that directly from the __beam__ stored on the element
    // fuck me, right?
    el.style[prop] = val + (unitless[prop] ? '' : el.__beam__.$t(prop).unit);
}

var instances = [];

function track(el) {
    // lemme know when proper object hashes become mainstream. 
    // until then, carry on young man
    if(el.__beam__) {
        return el.__beam__;
    }

    var twain = Twain().update(function(step) {
        setStyle(el, step);
    });

    // run a separate one for transforms
    var transformer = twain.transformer = Twain().update(function(step) {
        // get back units
        var o = {};
        each(step, function(val, prop){
            o[prop] = val + (unitless[prop] ? '' : transformer.$t(prop).unit);
        });
        // console.log(o);
        claw(el, o);
    });
    instances.push(twain);

    el.__beam__ = twain;
    return twain;
}

function beam(el, to) {
    var tracker = track(el);
    var o = {};
    each(to, function(val, _prop) {

        if(_prop === 'transform') return;
        var prop = camelize(vendor(_prop) + _prop);
        if(!tracker.tweens[prop]) {
            var currentStyle = getStyle(el, prop);
            var numerical = num(currentStyle);
            // this inits the specific Tween
            var tween = tracker.$t(prop).from(isValue(numerical) ? numerical : num(val));
            tween.unit = unit(currentStyle); // MASSIVE todo 
        }
        tracker.$t(prop).to(num(val));
    });

    if(to.transform) {
        var tr = {};
        var transformer = tracker.transformer;
        each(to.transform, function(val, prop){
            // not doing the currentStyle business here.
            // yet.
            transformer.$t(prop).to(num(val)).unit = unit(val);
        });
        
    }
    // return a curried version of self. awesome-o. 
    return function(d) {
        return beam(el, d);
    };
}

beam.instances = instances;

beam.stop = function(el) {
    // stop/pause the anim loop
    // if not el, then stop EVERYTHING.
};
beam.start = function(el) {
    // start up the anim loop after being paused
    // if not el, start up everything
}

// start off animation loop. 

function animate() {
    raf(animate);
    // use a quick for loop
    for(var i = 0, j = instances.length; i < j; i++) {
        instances[i].update().transformer.update();
    }
}

animate();

module.exports = beam;