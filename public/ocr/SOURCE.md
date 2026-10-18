# Local OCR assets

- worker.min.js: installed tesseract.js 7 package (Apache-2.0).
- core/: installed tesseract.js-core package (Apache-2.0), all WASM variants retained for browser feature detection.
- lang/tha.traineddata.gz and eng.traineddata.gz: @tesseract.js-data/tha@1.0.0 and @tesseract.js-data/eng@1.0.0, 4.0.0_best_int models (Apache-2.0).
  Source: https://github.com/naptha/tessdata
  Download: https://cdn.jsdelivr.net/npm/@tesseract.js-data/{tha,eng}@1.0.0/4.0.0_best_int/{tha,eng}.traineddata.gz

Browser OCR loads these files from the application origin, without contacting a third-party CDN or sending the card image to an OCR service. The original image is stored by the existing borrower images endpoint after extraction.

When upgrading tesseract.js, refresh worker.min.js and core/ together from the installed packages.
