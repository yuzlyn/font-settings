function attribute(tag, name, pattern, value) {
  pattern = name "=\"[^\"]*\""
  if (!match(tag, pattern)) return ""
  value = substr(tag, RSTART + length(name) + 2, RLENGTH - length(name) - 3)
  return value
}

function family_role(header, block, name, lang, normalized) {
  name = tolower(attribute(header, "name"))
  lang = tolower(attribute(header, "lang"))
  normalized = "," lang ","
  gsub(/[[:space:]_]+/, "-", normalized)

  if (name == "sans-serif" || name == "sys-sans-en" || name == "op-sans-en") {
    return "western"
  }
  if (normalized ~ /[,;-](zh|yue)(-|[,;])/) {
    return "chinese"
  }
  if (allow_unnamed == 1 && unnamed_default == 0 && name == "" && lang == "" &&
      block ~ /\.(ttf|otf|ttc)/ && block !~ /[Ee]moji|[Ss]ymbol|[Mm]ath/) {
    unnamed_default = 1
    return "western"
  }
  return ""
}

function emit_font(start, finish, role,    opening, indent, weight, target, variable, i) {
  opening = family_lines[start]
  indent = opening
  sub(/[^[:space:]].*$/, "", indent)

  for (i = start + 1; i <= finish && opening !~ />/; i++) {
    opening = opening " " family_lines[i]
  }
  gsub(/[\r\n\t]+/, " ", opening)
  sub(/^[[:space:]]*/, "", opening)
  sub(/>.*/, ">", opening)
  gsub(/[[:space:]]+(index|postScriptName|supportedAxes|axes|variationSettings)="[^"]*"/, "", opening)

  weight = attribute(opening, "weight")
  if (weight == "") weight = "400"
  if (role == "western") {
    target = western
    variable = western_variable
    western_fonts++
  } else {
    target = chinese
    variable = chinese_variable
    chinese_fonts++
  }

  print indent opening
  print indent "    " target
  if (variable == 1) {
    print indent "    <axis tag=\"wght\" stylevalue=\"" weight "\"/>"
  }
  print indent "</font>"
}

function emit_family(    header, block, role, i, finish) {
  header = ""
  block = ""
  for (i = 1; i <= family_count; i++) {
    block = block " " family_lines[i]
    if (header !~ />/) header = header " " family_lines[i]
  }
  role = family_role(header, block)

  if (role == "") {
    for (i = 1; i <= family_count; i++) print family_lines[i]
    return
  }

  i = 1
  while (i <= family_count) {
    if (family_lines[i] ~ /<font([[:space:]>])/) {
      finish = i
      while (finish <= family_count && family_lines[finish] !~ /<\/font>/) finish++
      if (finish <= family_count) {
        emit_font(i, finish, role)
        i = finish + 1
        continue
      }
    }
    print family_lines[i]
    i++
  }
}

BEGIN {
  in_family = 0
  family_count = 0
  western_fonts = 0
  chinese_fonts = 0
  unnamed_default = 0
}

{
  if (!in_family && $0 ~ /<family([[:space:]>])/) {
    in_family = 1
    family_count = 0
  }

  if (in_family) {
    family_lines[++family_count] = $0
    if ($0 ~ /<\/family>/) {
      emit_family()
      delete family_lines
      family_count = 0
      in_family = 0
    }
    next
  }

  print
}

END {
  if (in_family) {
    for (i = 1; i <= family_count; i++) print family_lines[i]
  }
  if (stats != "") print western_fonts " " chinese_fonts > stats
}
