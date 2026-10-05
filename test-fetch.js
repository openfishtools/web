fetch('https://studio.cutefish.my.id/api/project?id=fish-r76g7a')
  .then(r => r.json())
  .then(d => console.log(d))
  .catch(e => console.log(e));
