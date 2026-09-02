// Defect: FIGM-REACT-06
function Profile({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []);
  return <div>{userId}</div>;
}
