importScripts("https://cdn.jsdelivr.net/pyodide/dev/full/pyodide.js");

async function startDatasette() {
  self.pyodide = await loadPyodide({indexURL : "https://cdn.jsdelivr.net/pyodide/dev/full/"});
  await pyodide.loadPackage('micropip');
  await pyodide.loadPackage('ssl');
  await pyodide.loadPackage('setuptools'); // For pkg_resources
  await self.pyodide.runPythonAsync(`
  # Grab that fixtures.db database
  from pyodide.http import pyfetch
  names = []
  for name, url in (
      ("fixtures.db", "https://latest.datasette.io/fixtures.db"),
      ("content.db", "https://datasette.io/content.db"),
  ):
      response = await pyfetch(url)
      with open(name, "wb") as fp:
          fp.write(await response.bytes())
      names.append(name)

  import micropip
  await micropip.install(
      "https://s3.amazonaws.com/simonwillison-cors-allowed-public/python_baseconv-1.2.2-py3-none-any.whl",
      keep_going=True
  )
  await micropip.install(
      "https://s3.amazonaws.com/simonwillison-cors-allowed-public/click_default_group-1.2.2-py3-none-any.whl",
      keep_going=True
  )
  await micropip.install(
      "https://s3.amazonaws.com/simonwillison-cors-allowed-public/datasette-0.61.1-py3-none-any.whl",
      keep_going=True
  )
  from datasette.app import Datasette
  ds = Datasette(names, memory=True)
  `);
}

let readyPromise = startDatasette();

self.onmessage = async (event) => {
  // make sure loading is done
  await readyPromise;
  console.log(event, event.data);
  try {
    let [status, text] = await self.pyodide.runPythonAsync(
      `
      import json
      response = await ds.client.get(
          ${JSON.stringify(event.data.path)},
          follow_redirects=True
      )
      [response.status_code, response.text]
      `
    );
    self.postMessage({status, text});
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
