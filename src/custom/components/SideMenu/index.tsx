import styled from 'styled-components/macro'
import { transparentize } from 'polished'

export const SideMenu = styled.div`
  display: flex;
  flex-flow: column wrap;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  margin: 0 24px 0 0;
  color: ${({ theme }) => theme.text1};
  height: max-content;
  position: sticky;
  top: 0;
  width: 100%;
  padding: 38px 0 0;

  ${({ theme }) => theme.mediaWidth.upToSmall`
  padding: 0;
  position: relative;
`}

  > ul {
    display: flex;
    flex-flow: column wrap;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: inherit;

    ${({ theme }) => theme.mediaWidth.upToSmall`
    background: ${({ theme }) => transparentize(0.9, theme.text1)};
    border-radius: 16px;
    padding: 12px;
  `}
  }

  > ul > li {
    width: 100%;
  }

  > ul > li > a {
    margin: 4px 0;
    padding: 12px;
    border-radius: 6px;
    width: 100%;
    text-decoration: none;
    color: inherit;
    opacity: 0.65;
    transition: opacity 0.2s ease-in-out;
    display: block;

    ${({ theme }) => theme.mediaWidth.upToSmall`
    margin: 0;
  `}

    &:hover,
  &.active {
      opacity: 1;
    }

    &.active {
      ${({ theme }) => theme.mediaWidth.upToSmall`
      background: ${({ theme }) => transparentize(0.9, theme.text1)};
      border-radius: 16px;
    `}
    }
  }
`