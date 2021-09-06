// rpi-rgb
// Supplies simple method of controlling PWM rgb 
// lighting using raspberry pi GPIO

module.exports.Channel = Channel;
module.exports.Colour = Colour;

const Gpio = require('pigpio').Gpio;
const math = require('mathjs');

function Colour (red, green, blue) {
  this.red = red;
  this.green = green;
  this.blue = blue;
  
  this.clamp();
}

Colour.prototype.clamp = function() {
  this.red = Math.max(0, Math.min(this.red, 100));
  this.green = Math.max(0, Math.min(this.green, 100));
  this.blue = Math.max(0, Math.min(this.blue, 100));
}


function Channel(redPin, greenPin, bluePin) {
    
  this._pinRed   = new Gpio(redPin, {mode: Gpio.OUTPUT});
  this._pinGreen = new Gpio(greenPin, {mode: Gpio.OUTPUT});
  this._pinBlue  = new Gpio(bluePin, {mode: Gpio.OUTPUT});
 
  // Current RGB value
  this._valRed = 0;
  this._valGreen = 0;
  this._valBlue = 0;
  
  // Variables needed to track fading
  this._fade = {};
  this._fade.active = false;
  this._fade.pulse = false;
  this._fade.strobe = false;
  this._fade.steps = 0;
  this._fade.stepcount = 0;
  this._fade.dR = 0;
  this._fade.dG = 0;
  this._fade.dB = 0;
  
  this._timer;
  //initialize
  this._pinRed.pwmWrite(this._valRed);
  this._pinGreen.pwmWrite(this._valGreen);
  this._pinBlue.pwmWrite(this._valBlue);
  
};
    
Channel.prototype.setRgb = function (colour, callback) {
  
  clearInterval(this._timer);
  
  this._valRed = colour.red;
  this._valGreen = colour.green;
  this._valBlue = colour.blue;
  
  this._pinRed.pwmWrite(math.floor(this._valRed));
  this._pinGreen.pwmWrite(math.floor(this._valGreen));
  this._pinBlue.pwmWrite(math.floor(this._valBlue));
  
  if (typeof callback === 'function') callback();
  
  return 0;
};

Channel.prototype.fadeRgb = function (colour, time, callback) {
  
  // Don't interrupt strobing, try again in ~20ms
  if (this._fade.strobe === true) {
    setTimeout( function(self, colour, time, callback){
      self.fadeRgb(colour, time, callback);
    }, 20, this, colour, time, callback);
    return;  
  } 
  
  // Dividing time (ms) by 20 gives 50Hz update rate
  this._fade.steps = math.round(time / 20);

  this._fade.dR = (colour.red - this._valRed) / this._fade.steps;
  this._fade.dG = (colour.green - this._valGreen) / this._fade.steps;
  this._fade.dB = (colour.blue - this._valBlue) / this._fade.steps;

  this._fade.stepcount = 0;
  this._fade.active = true;
  
  this._updateFade(callback);
};

Channel.prototype.pulseRgb = function (startColour, endColour, fadeTime, pulseTime) {
  // Fades into start colour and then pulses between Start and End colors. 
  // fadeTime - governs how fast the LEDs fade to the start color.
  // pulseTime - governs how fast the pulse occurs in one direction,
  //             meaning one full cycle lasts 2* pulseTime.
  
  thisObj = this;
  
  this.fadeRgb(startColour, fadeTime, function() {
    thisObj._fade.pulse = true;
    thisObj.fadeRgb(endColour, pulseTime);  
  });
  
}

Channel.prototype.endPulse = function(callback) {
  this._fade.pulse = false;
  clearTimeout(this.timer);
  
  if (typeof callback === 'function') callback();
}

Channel.prototype.strobeRgb = function(colour, pulseLength, duration, callback) {
  
  var halfPeriod = pulseLength; // time in ms between switching on/off
  this._fade.steps = math.round(duration / halfPeriod);
  this._fade.stepcount = 0;
    
  // This line ensures ending in an 'off' state
  if (this._fade.steps % 2 === 0) this._fade.steps++; 
  
  this._fade.dR = colour.red;
  this._fade.dG = colour.green;
  this._fade.dB = colour.blue;
  
  this._fade.strobe = true;
  
  this._updateStrobe(halfPeriod, callback);
}

Channel.prototype.close = function () {
  this._pinRed.pwmWrite(0);
  this._pinGreen.pwmWrite(0);
  this._pinBlue.pwmWrite(0);
};

Channel.prototype._updateFade = function (callback) {
  var fadeInfo = this._fade; // Because of readability
    
  if (fadeInfo.active === false) return;
  
  this._valRed = this._valRed + fadeInfo.dR;
  this._valGreen = this._valGreen + fadeInfo.dG;
  this._valBlue = this._valBlue + fadeInfo.dB;

  this._pinRed.pwmWrite(math.floor(this._valRed));
  this._pinGreen.pwmWrite(math.floor(this._valGreen));
  this._pinBlue.pwmWrite(math.floor(this._valBlue));

  fadeInfo.stepcount++;
  
  if (fadeInfo.stepcount < fadeInfo.steps) {
    this.timer = setTimeout(function (thisObj) { thisObj._updateFade(callback); }, 20, this);
  } 
  else {
    // End of fade
    if (fadeInfo.pulse)
    {
      //reverse signs on RGB and reset stepcount
      fadeInfo.dR = -fadeInfo.dR;
      fadeInfo.dG = -fadeInfo.dG;
      fadeInfo.dB = -fadeInfo.dB;
      fadeInfo.stepcount = 0;
      
      this.timer = setTimeout(function (thisObj) { thisObj._updateFade(callback); }, 20, this);
    }
    else {
      //Clean up
      
      // math.abs is used to prevent channels from having a value of -0
      this._valRed = math.abs(math.round(this._valRed));
      this._valGreen = math.abs(math.round(this._valGreen));
      this._valBlue = math.abs(math.round(this._valBlue));
      
      this._fade.active = false;
      this._fade.steps = 0;
      this._fade.stepcount = 0;
      this._fade.dR = 0;
      this._fade.dG = 0;
      this._fade.dB = 0;  
      
      // If callback present, call it
      if (typeof callback === 'function') callback();
    }
  }
};

Channel.prototype._updateStrobe = function (halfPeriod, callback) {

  if (this._fade.strobe === false) return;
  
  switch (this._fade.stepcount % 2) {
    case 0:
      this.setRgb(new Colour(0,0,0));
      break;
    case 1:
      this.setRgb(new Colour(this._fade.dR, this._fade.dG, this._fade.dB));
      break;
  }
  
  this._fade.stepcount++;

  if (this._fade.stepcount < this._fade.steps) {
    setTimeout(function(self, time, callback) {self._updateStrobe(time, callback);}, halfPeriod, this, halfPeriod, callback);
  }
  else {
    this._fade.strobe = false;
    this._fade.steps = 0;
    this._fade.stepcount = 0;
    this._fade.dR = 0;
    this._fade.dG = 0;
    this._fade.dB = 0;  
    
    // If callback present, call it
    if (typeof callback === 'function') callback();
  }
  
}
