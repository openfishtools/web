fetch('http://localhost:5000/api/presets')
  .then(r => r.json())
  .then(d => {
     if(d && d.length > 0) console.log(d[0]);
  })
  .catch(e => console.log('error'));
