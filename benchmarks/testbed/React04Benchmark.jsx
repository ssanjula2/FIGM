// Defect: FIGM-REACT-04
function Parent({ handleAction }) {
  return <ButtonCard onClick={() => handleAction()} />;
}
