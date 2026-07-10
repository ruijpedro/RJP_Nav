export const marcosKmLinhaOeste = [
  { id:'inicio-21-190', nome:'PK 21+190 · Início do troço', pk:'21+190', km:21.190 },
  ...Array.from({ length: 170 }, (_, i) => {
    const km = 22 + i
    return { id:`pk-${km}`, nome:`PK ${km}+000`, pk:`${km}+000`, km }
  }),
  { id:'fim-191-197', nome:'PK 191+197 · Fim do troço', pk:'191+197', km:191.197 }
]

export const marcosPrincipaisLinhaOeste = [
  { pk:'21+190', nome:'Início do troço' },
  { pk:'25+377', nome:'Sabugo' },
  { pk:'64+157', nome:'Torres Vedras' },
  { pk:'106+436', nome:'Caldas da Rainha' },
  { pk:'160+691', nome:'Leiria' },
  { pk:'191+197', nome:'Fim do troço' }
]
