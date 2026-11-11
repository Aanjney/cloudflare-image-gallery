export const PLACEHOLDER_DEFAULT = '#0e0e0e';
export const PLACEHOLDER_SAMPLE_SIZE = 12;

/** JS snippet defining `placeholderFromImage(img)`. */
export const buildBrowserPlaceholderColorHelper = () =>
  `  function placeholderFromImage(img) {
    try {
      var c = document.createElement('canvas'), ctx = c.getContext('2d'), s = ${PLACEHOLDER_SAMPLE_SIZE};
      c.width = s; c.height = s; ctx.drawImage(img, 0, 0, s, s);
      var d = ctx.getImageData(0, 0, s, s).data;
      var r=0,g=0,b=0,t=s*s;
      for (var i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}
      return 'rgb('+Math.round(r/t)+','+Math.round(g/t)+','+Math.round(b/t)+')';
    } catch(_){ return '${PLACEHOLDER_DEFAULT}'; }
  }`;
