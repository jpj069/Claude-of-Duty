import { chromium } from 'playwright';

const variants = [
  { name: 'default (try real GPU)', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
  { name: 'angle/swiftshader', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  { name: 'egl', args: ['--use-gl=egl', '--ignore-gpu-blocklist'] },
];

for (const v of variants) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/opt/pw-browsers/chromium',
      args: [...v.args, '--no-sandbox', '--hide-scrollbars', '--mute-audio'],
    });
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return { webgl2: false };
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      // time 200 fullscreen-ish draws to gauge fill rate
      const t0 = performance.now();
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
      gl.compileShader(vs);
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, '#version 300 es\nprecision highp float;out vec4 o;void main(){vec3 c=vec3(0.);for(int i=0;i<64;i++)c+=sin(vec3(float(i))+gl_FragCoord.xyx*0.01);o=vec4(c*0.01,1.);}');
      gl.compileShader(fs);
      const pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); gl.useProgram(pr);
      const loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (let i = 0; i < 100; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
      const ms = performance.now() - t0;
      return {
        webgl2: true,
        renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : '?',
        ms100draws: Math.round(ms),
      };
    });
    console.log(v.name.padEnd(24), JSON.stringify(info));
  } catch (e) {
    console.log(v.name.padEnd(24), 'LAUNCH FAILED:', e.message.split('\n')[0]);
  } finally {
    await browser?.close();
  }
}
