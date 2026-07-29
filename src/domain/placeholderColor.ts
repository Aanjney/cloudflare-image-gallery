export const PLACEHOLDER_DEFAULT = '#0e0e0e';
export const PLACEHOLDER_SAMPLE_SIZE = 12;

export const averageRgbFromImageData = (data: Uint8ClampedArray, sampleSize: number): string => {
  const pixels = sampleSize * sampleSize;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return `rgb(${Math.round(r / pixels)},${Math.round(g / pixels)},${Math.round(b / pixels)})`;
};

/** JS snippet defining `placeholderFromImage(img)` — must stay aligned with `averageRgbFromImageData`. */
export const buildBrowserPlaceholderColorHelper = () =>
  `var PLACEHOLDER_DEFAULT = '${PLACEHOLDER_DEFAULT}';
  var PLACEHOLDER_SAMPLE_SIZE = ${PLACEHOLDER_SAMPLE_SIZE};
  var placeholderFromImage = function(img) {
    try {
      var c = document.createElement('canvas'), ctx = c.getContext('2d'), s = PLACEHOLDER_SAMPLE_SIZE;
      c.width = s; c.height = s; ctx.drawImage(img, 0, 0, s, s);
      var d = ctx.getImageData(0, 0, s, s).data;
      var r=0,g=0,b=0,t=s*s;
      for (var i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}
      return 'rgb('+Math.round(r/t)+','+Math.round(g/t)+','+Math.round(b/t)+')';
    } catch(_){ return PLACEHOLDER_DEFAULT; }
  };`;
