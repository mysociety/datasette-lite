importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js");

function log(line) {
  console.log({line})
  self.postMessage({type: 'log', line: line});
}

async function startDatasette(settings) {
  let toLoad = [];
  let templateFiles = [];
  let sources = [];
  let needsDataDb = false;
  let shouldLoadDefaults = true;
  if (settings.initialUrl) {
    let name = settings.initialUrl.split('.db')[0].split('/').slice(-1)[0];
    toLoad.push([name, settings.initialUrl]);
    shouldLoadDefaults = false;
  }
  ['csv', 'sql', 'json', 'parquet'].forEach(sourceType => {
    if (settings[`${sourceType}Urls`] && settings[`${sourceType}Urls`].length) {
      sources.push([sourceType, settings[`${sourceType}Urls`]]);
      needsDataDb = true;
      shouldLoadDefaults = false;
    }
  });
  if (settings.memory) {
    shouldLoadDefaults = false;
  }
  if (needsDataDb) {
    toLoad.push(["data.db", 0]);
  }
  if (shouldLoadDefaults) {
    toLoad.push(["fixtures.db", "https://latest.datasette.io/fixtures.db"]);
    toLoad.push(["content.db", "https://datasette.io/content.db"]);
  }

  self.pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.2/full/",
    fullStdLib: true
  });
  self.pyodide.globals.set("settings", settings);
  await pyodide.loadPackage('micropip', {messageCallback: log});
  await pyodide.loadPackage('ssl', {messageCallback: log});
  await pyodide.loadPackage('setuptools', {messageCallback: log}); // For pkg_resources
  try {
    await self.pyodide.runPythonAsync(`{{ web_worker_py }}`);
    await self.pyodide.runPythonAsync(`    
    install_urls = ${JSON.stringify(settings.installUrls)}
    sqls = ${JSON.stringify(sources.filter(source => source[0] === "sql")[0]?.[1] || [])}
    metadata_url = ${JSON.stringify(settings.metadataUrl || '')}
    sources = ${JSON.stringify(sources.filter(source => ['csv', 'json', 'parquet'].includes(source[0])))}
    memory_setting = ${settings.memory ? 'True' : 'False'}
    data_to_load = ${JSON.stringify(toLoad)}

    ds = await load_datasette(
          install_urls = install_urls,
          sqls = sqls,
          default_metadata = settings.default_metadata.to_py(),
          metadata_url = metadata_url,
          sources = sources,
          memory_setting = memory_setting,
          data_to_load = data_to_load,
          config_static = settings.config_static.to_py()
          )
            
    
    `);
    datasetteLiteReady();
  } catch (error) {
    self.postMessage({error: error.message});
  }
}

// Outside promise pattern
// https://github.com/simonw/datasette-lite/issues/25#issuecomment-1116948381
let datasetteLiteReady;
let readyPromise = new Promise(function(resolve) {
  datasetteLiteReady = resolve;
});

self.onmessage = async (event) => {
  console.log({event, data: event.data});
  if (event.data.type == 'startup') {
    await startDatasette(event.data);
    return;
  }
  // make sure loading is done
  await readyPromise;
  console.log(event, event.data);
  try {
    let [status, contentType, text] = await self.pyodide.runPythonAsync(
      `get_lite_response(ds, ${JSON.stringify(event.data.path)})`
    );
    self.postMessage({status, contentType, text});
  } catch (error) {
    self.postMessage({error: error.message});
  }
};
