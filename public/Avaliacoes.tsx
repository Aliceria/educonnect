import Cadastro from './Cadastro';
export default function Avaliacoes() {
  return <><h2>Avaliações e desempenho</h2><Cadastro titulo="Avaliações" tipo="avaliacoes" aviso="As avaliações usam os alunos do módulo 1." campos={[
    {nome:'nome',rotulo:'Avaliação'}, {nome:'alunoId',rotulo:'Aluno',fonte:'alunos'}, {nome:'disciplinaId',rotulo:'Disciplina',fonte:'disciplinas'},
    {nome:'data',rotulo:'Data',tipo:'data'}, {nome:'nota',rotulo:'Nota obtida',tipo:'numero'}, {nome:'notaMaxima',rotulo:'Nota máxima',tipo:'numero',minimo:0.01,inicial:10},
    {nome:'mediaEscolar',rotulo:'Média escolar (mesma escala)',tipo:'numero',inicial:6}, {nome:'conteudos',rotulo:'Conteúdos cobrados',fonte:'conteudos',tipo:'multiplo',depende:'disciplinaId',opcional:true},
    {nome:'dificuldades',rotulo:'Dificuldades',tipo:'area',opcional:true}, {nome:'reforcar',rotulo:'O que reforçar',tipo:'area',opcional:true},
  ]} rodape={(lista,refs) => <div><h3>Comparação de resultados</h3>{[...lista].sort((a,b) => String(a.dados.data).localeCompare(String(b.dados.data))).map(r => <p key={r.id}>
    {refs.alunos?.find(a => a.id === r.dados.alunoId)?.nome} — {String(r.dados.nome)} ({String(r.dados.data)}): {Number(r.dados.nota)} / {Number(r.dados.notaMaxima)}<br />
    <progress aria-label={`Aproveitamento em ${r.dados.nome}`} max={100} value={Number(r.dados.nota)/Number(r.dados.notaMaxima)*100} /> {(Number(r.dados.nota)/Number(r.dados.notaMaxima)*100).toFixed(1)}%
    <br />Média escolar: {Number(r.dados.mediaEscolar)} / {Number(r.dados.notaMaxima)} — {Number(r.dados.nota)>=Number(r.dados.mediaEscolar)?'Na média ou acima':'Abaixo da média'}
  </p>)}</div>} /></>;
}
