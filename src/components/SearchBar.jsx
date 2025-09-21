import React from 'react';
import { InputGroup, InputLeftElement, Input } from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { useData } from '../context/DataContext';
import useDebounce from '../hooks/useDebounce';

export default function SearchBar() {
  const { setQuery } = useData();
  const [value, setValue] = React.useState('');
  const debounced = useDebounce(value, 200);

  React.useEffect(() => {
    setQuery(debounced);
  }, [debounced, setQuery]);

  return (
    <InputGroup maxW={{ base: '100%', md: '360px' }}>
      <InputLeftElement pointerEvents="none">
        <FiSearch />
      </InputLeftElement>
      <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Search faculty, email, department..." rounded="md" />
    </InputGroup>
  );
}

