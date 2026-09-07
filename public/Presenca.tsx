import Cadastro from './Cadastro';
export default function Presenca() {
  return <><h2>Controle de presença</h2><Cadastro titulo="Frequência das aulas" tipo="presencas" aviso="As aulas vêm do módulo 2. O registro de presença não altera cobranças nem créditos do módulo 5." campos={[
    {nome:'aulaId',rotulo:'Aula',fonte:'aulas'}, {nome:'status',rotulo:'Situação',opcoes:['Presente','Realizada','Falta','Falta justificada','Falta do professor','Cancelada pelo aluno','Cancelada pelo professor','Reagendada','Reposição realizada']},
    {nome:'justificativa',rotulo:'Justificativa / observação',tipo:'area',opcional:true},
  ]} rodape={(lista,refs) => <><h3>Frequência por aluno</h3><p>Cancelamentos, reagendamentos e faltas do professor ficam fora do cálculo. Faltas justificadas do aluno contam como falta.</p>
    {refs.alunos?.map(aluno => {
      const registros = lista.filter(r => r.dados.alunoId === aluno.id);
      const presentes = registros.filter(r => ['Presente','Realizada','Reposição realizada'].includes(String(r.dados.status))).length;
      const faltas = registros.filter(r => ['Falta','Falta justificada'].includes(String(r.dados.status))).length;
      return <p key={aluno.id}>{aluno.nome}: {presentes + faltas ? `${(presentes/(presentes+faltas)*100).toFixed(1)}% (${presentes} presenças, ${faltas} faltas)` : 'sem registros'}</p>;
    })}</>} /></>;
}
