# The firegoose install page is located at:
# http://gaggle.systemsbiology.net/docs/geese/firegoose/install/ .
# The install page reads the RDF to locate the release version and
# links to the highest numbered xpi file as the dev release.
#
scp ./dist/firegoose-*.xpi bragi:/local/apache2/docs/gaggle-secure/firegoose/
scp ./dist/firegoose_update.rdf bragi:/local/apache2/docs/gaggle-secure/firegoose/
