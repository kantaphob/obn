import { createWorker, PSM } from 'tesseract.js';

/** Keep the worker, WASM and language data on the same origin as the form. */
export async function readIdCardImage(file: File, onProgress: (value:number)=>void): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failure = new Promise<never>((_, reject) => {
    timer = setTimeout(()=>reject(new Error('อ่านภาพใช้เวลานานเกินไป กรุณาครอปเฉพาะหน้าบัตรและลองอีกครั้ง')),120000);
  });
  const work = (async()=>{
    worker = await createWorker('tha+eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      // Worker failures are propagated by the operation promise; do not throw again globally.
      errorHandler: ()=>{},
      logger: message=>{
        if(expired)return;
        if(message.status==='recognizing text') onProgress(20+Math.round(message.progress*80));
        else if(message.status==='loading language traineddata') onProgress(5+Math.round(message.progress*15));
      },
    });
    if(expired){await worker.terminate();return '';}
    const bitmap = await createImageBitmap(file);
    let image:HTMLCanvasElement;
    try {
      const scale = Math.min(3,2400/Math.max(bitmap.width,bitmap.height));
      image = document.createElement('canvas');
      image.width = Math.max(1,Math.round(bitmap.width*scale));
      image.height = Math.max(1,Math.round(bitmap.height*scale));
      const context = image.getContext('2d');
      if(!context)throw new Error('เบราว์เซอร์ไม่รองรับการเตรียมภาพ OCR');
      context.fillStyle='#fff';context.fillRect(0,0,image.width,image.height);
      context.drawImage(bitmap,0,0,image.width,image.height);
    } finally {bitmap.close();}
    await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1'});
    const result = await worker.recognize(image);
    if(expired)return '';
    await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
    const sparse = await worker.recognize(image);
    return `${result.data.text}\n\n${sparse.data.text}`;
  })();
  try {return await Promise.race([work,failure]);}
  finally {expired=true;clearTimeout(timer);await worker?.terminate().catch(()=>{});}
}
