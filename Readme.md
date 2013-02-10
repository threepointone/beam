
# beam

  because tractor beams are cool.

  ![void](http://i.imgur.com/QhvCi7F.png)

  gives a generic way to animate any numeric css val on an element. uses [twain](https://github.com/threepointone/twain) for animation

## Installation

    $ component install threepointone/beam

## API

based on [twain](https://github.com/threepointone/twain) and [claw](https://github.com/threepointone/claw).

```js

var el = document.getELementById('box');

document.body.addEventListener('mousemove', function(e){
    beam(el,{
        top: e.clientY + 'px',
        left: e.clientX + 'px'
    });
});

// 

```
 - makes the box follow the mouse. it sounds silly, I know. The [demo's](http://threepointone.github.com/beam/) trippier.

## License

  MIT
