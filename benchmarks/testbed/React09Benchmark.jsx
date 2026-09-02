// Defect: FIGM-REACT-09
function Logger({ endpoint }) {
  fetch(endpoint);
  return <p>logging</p>;
}
