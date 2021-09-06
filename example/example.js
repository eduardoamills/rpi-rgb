const RgbChannel = require('rpi-rgb').Channel;
const Colour = require('rpi-rgb').Colour;

const channel1 = new RgbChannel(13,5,6);

const red = new Colour(100,0,0);
const softRed = new Colour(10,0,0);
const blue = new Colour(0,0,100);
const white = new Colour(255,255,255);
const yellow = new Colour(255,255,0);

// Start by fading to blue.
channel1.fadeRgb(blue, 5000, function() {
  // When that's done, strobe.
  channel1.strobeRgb(white, 18, 5000, function() {
    // After strobing, fade to yellow.
    channel1.fadeRgb(yellow, 5000, function(){
		channel1.close();
	});
  });
});

// After the timeout, all the above is likely done, so start pulsing red.
setTimeout(function(thisobj) {
	thisobj.pulseRgb(softRed, red, 800, 1500);
}, 7000, channel1);
