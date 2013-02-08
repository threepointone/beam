var animloop = require('animloop'),
    Twain = require('twain');
each = Twain.util.each, collect = Twain.util.collect, isValue = Twain.util.isValue;

var doc = document,
    numUnit = /^(?:[\+\-]=)?\d+(?:\.\d+)?(%|in|cm|mm|em|ex|pt|pc|px)$/;

// does this browser support the opacity property?
var opasity = function() {
        return typeof doc.createElement('a').style.opacity !== 'undefined';
    }();

function camelize(s) {
    return s.replace(/-(.)/g, function(m, m1) {
        return m1.toUpperCase()
    })
}


function uppercase(p, a) {
    return a.toUpperCase();
}

function vendor(property) {

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
    return 'px';
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
    property = camelize(property)

    if(property == 'opacity') {
        var val = 100
        try {
            val = el.filters['DXImageTransform.Microsoft.Alpha'].opacity
        } catch(e1) {
            try {
                val = el.filters('alpha').opacity
            } catch(e2) {}
        }
        return val / 100
    }
    var value = el.currentStyle ? el.currentStyle[property] : null
    return el.style[property] || value
} : function(el, property) {
    return el.style[camelize(property)]
};

function setStyle(el, prop, style) {
    if(typeof prop !== 'string') {
        each(prop, function(v, p) {
            setStyle(el, p, v);
        });
        return;
    }
    // ok, so this the weird part 
    // because we're getting a number, we need to add unit to it 
    // we get that directly from the element
    // fuck me, right?
    el.style[camelize(prop)] = style + (prop === 'opacity' ? '' : el.__tractor__.$t(prop).unit);
}


function Tractor(config) {


    if(!(this instanceof Tractor)) return new Tractor(config);

    this.config = config || {};

    animloop.start();

}

Tractor.instances = [];



Tractor.prototype.beam = function(el, to) {
    if(!el.__tractor__) {
        el.__tractor__ = Twain(this.config).update(function(step) {
            setStyle(el, step);
        });
        Tractor.instances.push(el.__tractor__);
    }
    var tractor = el.__tractor__;

    var o = {};
    each(to, function(val, prop) {

        prop = vendor(prop) + prop;

        if(!tractor.tweens[prop]) {
            var currentStyle = getStyle(el, prop);
            var _unit = unit(currentStyle) || 'px';
            var _num = num(currentStyle);
            // this inits the specific Tween
            tractor.$t(prop).unit = _unit;
            if(isValue(_num)) {
                tractor.$t(prop).from(_num);
            }

        }

        o[prop] = num(val);


    });
    tractor.to(o);


};

animloop.on('beforedraw', function() {
    each(Tractor.instances, function(t) {
        t.update();
    });
});



module.exports = Tractor;