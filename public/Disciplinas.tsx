import Cadastro from './Cadastro';

export default function Disciplinas() {
  return <><h2>Disciplinas e conteúdos</h2>
    <Cadastro titulo="Disciplinas" tipo="disciplinas" campos={[
      {nome:'nome',rotulo:'Nome'}, {nome:'descricao',rotulo:'Descrição',tipo:'area',opcional:true}, {nome:'status',rotulo:'Situação',opcoes:['Ativa','Inativa']},
    ]} />
    <Cadastro titulo="Conteúdos" tipo="conteudos" campos={[
      {nome:'nome',rotulo:'Nome'}, {nome:'disciplinaId',rotulo:'Disciplina',fonte:'disciplinas'}, {nome:'classificacao',rotulo:'Classificação'},
      {nome:'dificuldade',rotulo:'Nível',opcoes:['Básico','Intermediário','Avançado']}, {nome:'relacionados',rotulo:'Conteúdos relacionados',tipo:'multiplo',fonte:'conteudos',opcional:true},
    ]} />
    <Cadastro titulo="Aprendizado por aluno" tipo="aprendizados" aviso="Os alunos serão disponibilizados pelo módulo 1." campos={[
      {nome:'alunoId',rotulo:'Aluno',fonte:'alunos'}, {nome:'conteudoId',rotulo:'Conteúdo',fonte:'conteudos'},
      {nome:'status',rotulo:'Situação',opcoes:['Não iniciado','Em andamento','Dominado']}, {nome:'dificuldades',rotulo:'Dificuldades',tipo:'area',opcional:true},
    ]} />
  </>;
}
