import re
import logging

logger = logging.getLogger("CharacterCorrection")

class CharacterCorrector:
    """
    OCR Character Correction module for Ethiopian License Plates.
    Positional rules:
    - Letter section: 0 -> O, 1 -> I, 8 -> B, 5 -> S, 2 -> Z, 6 -> G
    - Number section: O -> 0, I -> 1, L -> 1, B -> 8, S -> 5, Z -> 2, G -> 6
    """

    LETTER_TO_DIGIT = {
        'O': '0', 'Q': '0', 'D': '0',
        'I': '1', 'L': '1', '|': '1',
        'Z': '2',
        'E': '3',
        'A': '4',
        'S': '5',
        'G': '6', 'b': '6',
        'T': '7',
        'B': '8',
        'g': '9', 'P': '9'
    }

    DIGIT_TO_LETTER = {
        '0': 'O',
        '1': 'I',
        '2': 'Z',
        '3': 'E',
        '4': 'A',
        '5': 'S',
        '6': 'G',
        '8': 'B',
    }

    @classmethod
    def correct(cls, text: str) -> str:
        if not text:
            return ""

        # Clean: keep A-Z and 0-9
        clean = re.sub(r'[^A-Z0-9]', '', text.upper())
        if not clean:
            return ""

        code_part = ""
        body = clean

        # Extract leading Code digit if present (e.g., '3AA123456')
        if clean[0] in ['1', '2', '3', '4', '5'] and len(clean) >= 4:
            code_part = clean[0]
            body = clean[1:]

        letters_part = ""
        digits_part = ""

        # Positional character parsing
        for idx, char in enumerate(body):
            if char.isalpha():
                if not digits_part:
                    letters_part += char
                else:
                    # Letter in number section -> convert letter to digit
                    digits_part += cls.LETTER_TO_DIGIT.get(char, char)
            elif char.isdigit():
                if not letters_part and idx < 3:
                    # Digit in letter section -> convert digit to letter
                    letters_part += cls.DIGIT_TO_LETTER.get(char, char)
                else:
                    digits_part += char

        # Correct remaining numeric portion
        corrected_digits = ""
        for ch in digits_part:
            corrected_digits += cls.LETTER_TO_DIGIT.get(ch, ch)

        result = f"{code_part}{letters_part}{corrected_digits}"
        return result if result else clean
